/**
 * Код формы для сайта компании. Публичного адреса API в настройках frontend нет
 * (API_BASE_URL — внутренний адрес сервера Next.js), поэтому адрес подставляет тот,
 * кто размещает форму: в коде он помечен как API_ADDRESS_PLACEHOLDER.
 */
export const API_ADDRESS_PLACEHOLDER = "https://АДРЕС-API-CRM"

/** Адрес отправки с пометкой, куда подставить адрес API */
export function publicEndpointUrl(endpointPath: string): string {
  return `${API_ADDRESS_PLACEHOLDER}${endpointPath}`
}

/** Обычная HTML-форма и отправка через fetch (JSON). Поле website — ловушка для ботов, скрыто от людей */
export function buildEmbedSnippet(endpointPath: string): string {
  const endpoint = JSON.stringify(publicEndpointUrl(endpointPath))
  return `<form id="crm-lead-form">
  <input name="name" placeholder="Имя" required maxlength="200">
  <input name="phone" type="tel" placeholder="+996 555 123 456" maxlength="32">
  <input name="email" type="email" placeholder="E-mail" maxlength="254">
  <textarea name="comment" placeholder="Комментарий" maxlength="2000"></textarea>
  <input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
  <button type="submit">Отправить</button>
  <p id="crm-lead-form-status" role="status"></p>
</form>
<script>
(function () {
  var form = document.getElementById("crm-lead-form");
  var status = document.getElementById("crm-lead-form-status");
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var data = new FormData(form);
    if (!data.get("phone") && !data.get("email")) {
      status.textContent = "Укажите телефон или e-mail.";
      return;
    }
    var params = new URLSearchParams(window.location.search);
    var body = {
      name: data.get("name"),
      phone: data.get("phone") || null,
      email: data.get("email") || null,
      comment: data.get("comment") || null,
      website: data.get("website") || null,
      page_url: window.location.href.slice(0, 500),
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign")
    };
    var button = form.querySelector("button[type=submit]");
    button.disabled = true;
    status.textContent = "Отправляем…";
    fetch(${endpoint}, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (response) {
      if (response.ok) {
        form.reset();
        status.textContent = "Спасибо! Мы скоро свяжемся с вами.";
      } else if (response.status === 400) {
        status.textContent = "Проверьте данные: укажите телефон полностью, например 0555 123 456 или +996 555 123 456.";
      } else if (response.status === 429) {
        status.textContent = "Слишком много попыток. Повторите через минуту.";
      } else {
        status.textContent = "Не удалось отправить заявку. Попробуйте позже или позвоните нам.";
      }
    }).catch(function () {
      status.textContent = "Нет связи. Попробуйте позже.";
    }).finally(function () {
      button.disabled = false;
    });
  });
})();
</script>`
}
