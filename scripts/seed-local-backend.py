#!/usr/bin/env python3
"""Тестовые данные для ручной проверки CRM на ЛОКАЛЬНОМ backend (docker compose из pied-piper).

Источник учётных записей — mocks/demo-accounts.seed.ts: те же логины и пароли, что в демо-режиме.
Компании и отделы создаются средствами Django в контейнере api (provision_tenant и ORM),
клиенты, сделки и задачи — через публичный API под соответствующими пользователями, поэтому
действуют все правила backend (видимость, лимит открытых задач, назначение исполнителя).

Скрипт повторяемый: существующие записи не дублирует и ничего не удаляет. Пароли не печатает.
Только для локального стенда — не запускайте против общих или production-окружений.

    python3 scripts/seed-local-backend.py [--backend ../pied-piper] [--api http://localhost:8000]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED_FILE = ROOT / "mocks" / "demo-accounts.seed.ts"

# Компании демо-режима → tenant локального backend
TENANTS = {"c-demo": ("demo", "Demo Company"), "c-sample": ("sample", "ОсОО «Пример»")}
# Роли интерфейса → хранимые роли backend
BACKEND_ROLES = {"director": "director", "head_of_sales": "head_of_sales", "manager": "sales_rep", "viewer": "viewer"}

STAGES = [
    {"name": "Новый", "probability": 10, "kind": "open"},
    {"name": "Квалификация", "probability": 30, "kind": "open"},
    {"name": "Предложение", "probability": 60, "kind": "open"},
    {"name": "Выиграна", "probability": 100, "kind": "won"},
    {"name": "Проиграна", "probability": 0, "kind": "lost"},
]
LOSS_REASONS = ["Дорого", "Выбрали конкурента", "Нет бюджета"]

# Сделки менеджеров: (владелец, название, сумма, клиент, телефон, следующий шаг)
DEALS = [
    ("aibek", "Поставка оборудования", "150000.00", "ОсОО «Альфа Трейд»", "+996555100001", "Отправить КП"),
    ("aibek", "Сервисный контракт на год", "48000.00", "ИП Садыкова", "+996555100002", None),
    ("aibek", "Лицензии на 20 мест", "320000.00", "ОсОО «Бета Софт»", "+996555100003", "Созвон с ЛПР"),
    ("nurlan", "Обучение персонала", "90000.00", "ОсОО «Гамма»", "+996555100004", "Согласовать даты"),
    ("nurlan", "Аудит процессов продаж", "60000.00", "ОсОО «Дельта»", None, None),
    ("aziz", "Внедрение CRM в Оше", "210000.00", "ОсОО «Ош Маркет»", "+996555100005", "Демо для директора"),
    ("aziz", "Поддержка 24/7", "36000.00", "ИП Мамытов", "+996555100006", None),
    ("director.sample", "Пилот для «Примера»", "75000.00", "ОсОО «Клиент Примера»", None, "Подписать договор"),
]

# Задачи: (владелец, сделка, название, срок в днях от сегодня или None)
TASKS = [
    ("aibek", "Поставка оборудования", "Отправить КП клиенту", -2),
    ("aibek", "Лицензии на 20 мест", "Позвонить ЛПР", 0),
    ("nurlan", "Обучение персонала", "Согласовать даты обучения", 3),
    ("aziz", "Внедрение CRM в Оше", "Подготовить демо", 1),
]


def parse_seed() -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    text = SEED_FILE.read_text(encoding="utf-8")
    manager_password = re.search(r'MANAGER_PASSWORD = "([^"]+)"', text)
    departments = [
        dict(zip(("id", "companyId", "name"), match))
        for match in re.findall(r'\{ id: "(d-[^"]+)", companyId: "([^"]+)", name: "([^"]+)" \}', text)
    ]
    accounts = []
    for line in re.findall(r"\{ id: \"[^\"]+\", login: .*\}", text):
        def field(name: str) -> str | None:
            found = re.search(rf'{name}: "([^"]*)"', line)
            return found.group(1) if found else None

        password = field("password") or (manager_password.group(1) if manager_password and "MANAGER_PASSWORD" in line else None)
        accounts.append(
            {
                "login": field("login") or "",
                "password": password or "",
                "fullName": field("fullName") or "",
                "role": field("role") or "",
                "companyId": field("companyId") or "",
                "departmentId": field("departmentId") or "",
                "status": field("status") or "active",
            }
        )
    return departments, accounts


def compose(backend: pathlib.Path, *args: str, stdin: str | None = None) -> str:
    result = subprocess.run(
        ["docker", "compose", *args], cwd=backend, input=stdin, capture_output=True, text=True, check=False
    )
    if result.returncode != 0:
        sys.exit(f"docker compose {' '.join(args[:3])}… завершился с ошибкой:\n{result.stderr[-2000:]}")
    return result.stdout


DJANGO_USERS = r"""
import json, sys
from django.contrib.auth import get_user_model
from modules.organizations.infrastructure.models import Department, Membership, Organization

data = json.loads(sys.stdin.read())
User = get_user_model()
for account in data["platform_admins"]:
    # Администратор платформы: признак аккаунта, а не роль в компании — членств у него нет
    user, created = User.objects.using("default").get_or_create(
        username=account["login"], defaults={"email": account["login"] + "@crm.local"}
    )
    first, _, last = account["fullName"].partition(" ")
    user.first_name, user.last_name, user.is_platform_admin = first, last, True
    user.set_password(account["password"])
    user.save(using="default")
    Membership.objects.using("default").filter(user=user).update(is_active=False)
    print(("создан " if created else "обновлён ") + account["login"] + " (администратор платформы)")
for account in data["accounts"]:
    org = Organization.objects.using("default").get(slug=account["tenant"])
    department = None
    if account["department"]:
        department, _ = Department.objects.using("default").get_or_create(organization=org, name=account["department"])
    user, created = User.objects.using("default").get_or_create(
        username=account["login"], defaults={"email": account["login"] + "@crm.local"}
    )
    first, _, last = account["fullName"].partition(" ")
    user.first_name, user.last_name = first, last
    user.set_password(account["password"])
    user.save(using="default")
    # Одна активная компания на пользователя: остальные членства выключаются
    Membership.objects.using("default").filter(user=user).exclude(organization=org).update(is_active=False)
    Membership.objects.using("default").update_or_create(
        user=user,
        organization=org,
        defaults={"role": account["role"], "department": department, "is_active": account["active"]},
    )
    print(("создан " if created else "обновлён ") + account["login"])
"""


class Api:
    def __init__(self, base: str, tenant: str) -> None:
        self.base = base.rstrip("/") + "/api/v1"
        self.tenant = tenant
        self.tokens: dict[str, str] = {}

    def call(self, method: str, path: str, body: Any = None, *, user: str | None = None) -> tuple[int, Any]:
        headers = {"Content-Type": "application/json", "X-Tenant": self.tenant}
        if user:
            headers["Authorization"] = "Bearer " + self.tokens[user]
        data = json.dumps(body).encode() if body is not None else None
        for _ in range(5):
            request = urllib.request.Request(self.base + path, method=method, data=data, headers=headers)
            try:
                with urllib.request.urlopen(request) as response:
                    raw = response.read()
                    return response.status, json.loads(raw) if raw else None
            except urllib.error.HTTPError as error:
                raw = error.read()
                if error.code == 429 and error.headers.get("Retry-After"):
                    time.sleep(int(error.headers["Retry-After"]) + 1)
                    continue
                return error.code, json.loads(raw) if raw else None
        sys.exit(f"{method} {path}: слишком много запросов, повторите позже")

    def login(self, login: str, password: str) -> None:
        status, body = self.call("POST", "/auth/token/", {"username": login, "password": password})
        if status != 200:
            sys.exit(f"Не удалось войти как {login}: HTTP {status}")
        self.tokens[login] = body["access"]


def seed_business_data(api: Api, owners: list[str], director: str) -> None:
    status, pipelines = api.call("GET", "/sales/pipelines/", user=director)
    pipeline = next((p for p in pipelines if p["name"] == "Основные продажи"), None)
    if pipeline is None:
        status, pipeline = api.call(
            "POST", "/sales/pipelines/", {"name": "Основные продажи", "is_default": True, "stages": STAGES}, user=director
        )
        assert status == 201, pipeline
    _, reasons = api.call("GET", "/sales/loss-reasons/", user=director)
    for name in LOSS_REASONS:
        if name not in {r["name"] for r in reasons["results"]}:
            api.call("POST", "/sales/loss-reasons/", {"name": name}, user=director)

    deal_ids: dict[str, str] = {}
    for owner, title, amount, customer, phone, next_step in DEALS:
        if owner not in owners:
            continue
        _, found = api.call("GET", "/sales/deals/?search=" + urllib.request.quote(title), user=owner)
        existing = next((d for d in found["results"] if d["title"] == title), None)
        if existing:
            deal_ids[title] = existing["id"]
            continue
        status, created_customer = api.call(
            "POST", "/customers/", {"name": customer, **({"phone": phone} if phone else {})}, user=owner
        )
        assert status == 201, created_customer
        body = {"title": title, "amount": amount, "currency": "KGS", "pipeline_id": pipeline["id"], "customer_id": created_customer["id"]}
        if next_step:
            body["next_step"] = next_step
        status, deal = api.call("POST", "/sales/deals/", body, user=owner)
        assert status == 201, deal
        deal_ids[title] = deal["id"]
        print(f"  сделка «{title}» ({owner})")

    today = dt.date.today()
    for owner, deal_title, title, days in TASKS:
        if owner not in owners or deal_title not in deal_ids:
            continue
        query = f"/activities/?kind=task&subject_type=deal&subject_id={deal_ids[deal_title]}"
        _, existing = api.call("GET", query, user=owner)
        if any(task["title"] == title for task in existing["results"]):
            continue
        body = {"kind": "task", "subject_type": "deal", "subject_id": deal_ids[deal_title], "title": title, "task_type": "call"}
        if days is not None:
            body["due_date"] = str(today + dt.timedelta(days=days))
        status, task = api.call("POST", "/activities/", body, user=owner)
        print(f"  задача «{title}» ({owner}): HTTP {status}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--backend", default=str(ROOT.parent / "pied-piper"), help="каталог pied-piper")
    parser.add_argument("--api", default="http://localhost:8000", help="адрес локального backend")
    args = parser.parse_args()
    backend = pathlib.Path(args.backend).resolve()

    departments, accounts = parse_seed()
    department_names = {d["id"]: d["name"] for d in departments}

    for company_id, (slug, name) in TENANTS.items():
        compose(
            backend, "exec", "-T", "-e", "TENANT_PROVISIONING_ENABLED=true", "api",
            "python", "manage.py", "provision_tenant", slug, "--name", name, "--create-organization",
        )
        print(f"компания {slug}: готова")

    payload = [
        {
            "login": a["login"],
            "password": a["password"],
            "fullName": a["fullName"],
            "tenant": TENANTS[a["companyId"]][0],
            "role": BACKEND_ROLES[a["role"]],
            "department": department_names.get(a["departmentId"]),
            "active": a["status"] != "deactivated",
        }
        for a in accounts
        if a["companyId"] in TENANTS and a["role"] in BACKEND_ROLES
    ]
    platform_admins = [
        {"login": a["login"], "password": a["password"], "fullName": a["fullName"]}
        for a in accounts
        if a["role"] == "platform_admin"
    ]
    print(compose(backend, "exec", "-T", "api", "python", "manage.py", "shell", "-c", DJANGO_USERS,
                  stdin=json.dumps({"accounts": payload, "platform_admins": platform_admins})).strip())

    passwords = {a["login"]: a["password"] for a in payload if a["active"]}
    for company_id, (slug, _) in TENANTS.items():
        members = [a["login"] for a in payload if a["tenant"] == slug and a["active"]]
        director = next(a["login"] for a in payload if a["tenant"] == slug and a["role"] == "director")
        owners = sorted({deal[0] for deal in DEALS} & set(members))
        api = Api(args.api, slug)
        for login in {director, *owners}:
            api.login(login, passwords[login])
        print(f"данные компании {slug}:")
        seed_business_data(api, owners, director)
    print("Готово. Логины и пароли — в mocks/demo-accounts.seed.ts.")


if __name__ == "__main__":
    main()
