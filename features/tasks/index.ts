/** Публичный API модуля «Задачи». Другие модули импортируют только отсюда. */
export { TasksView, TasksViewSkeleton } from "@/features/tasks/components/tasks-view"
export { TasksList } from "@/features/tasks/components/tasks-list"
export { tasksRepository } from "@/features/tasks/api/tasks-repository"
export type { Task, TaskType, TodayTasks } from "@/features/tasks/schemas"
