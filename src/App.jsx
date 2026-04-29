import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock3,
  ListChecks,
  Plus,
  Search,
  TimerReset,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'

const STORAGE_KEY = 'todo-reminder-items-v1'

const priorities = {
  high: { label: '高优先级', short: '高', color: 'priority-high' },
  medium: { label: '中优先级', short: '中', color: 'priority-medium' },
  low: { label: '低优先级', short: '低', color: 'priority-low' },
}

const filters = [
  { id: 'all', label: '全部' },
  { id: 'today', label: '今天' },
  { id: 'upcoming', label: '即将' },
  { id: 'overdue', label: '逾期' },
  { id: 'done', label: '完成' },
]

function toInputValue(date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function createBlankForm() {
  const nextHour = new Date(Date.now() + 60 * 60 * 1000)
  nextHour.setMinutes(0, 0, 0)

  return {
    title: '',
    note: '',
    dueAt: toInputValue(nextHour),
    priority: 'medium',
  }
}

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function sameDay(firstDate, secondDate) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  )
}

function getDueDate(task) {
  if (!task.dueAt) return null
  const date = new Date(task.dueAt)
  return Number.isNaN(date.getTime()) ? null : date
}

function getTaskStatus(task, now) {
  if (task.completed) return { key: 'done', label: '已完成' }

  const dueDate = getDueDate(task)
  if (!dueDate) return { key: 'planned', label: '待安排' }

  if (dueDate.getTime() < now.getTime()) return { key: 'overdue', label: '已逾期' }
  if (sameDay(dueDate, now)) return { key: 'today', label: '今天' }

  const threeDays = 3 * 24 * 60 * 60 * 1000
  if (dueDate.getTime() - now.getTime() <= threeDays) {
    return { key: 'upcoming', label: '即将到期' }
  }

  return { key: 'planned', label: '计划中' }
}

function formatDueAt(dueAt) {
  const date = new Date(dueAt)
  if (Number.isNaN(date.getTime())) return '未设置时间'

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatNextReminder(task) {
  if (!task) return '暂无'
  return `${task.title} · ${formatDueAt(task.dueAt)}`
}

function getSnoozedDueAt(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function App() {
  const [tasks, setTasks] = useState(loadTasks)
  const [form, setForm] = useState(createBlankForm)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => new Date())
  const [activeReminders, setActiveReminders] = useState([])
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (!('Notification' in window)) return 'unsupported'
    return Notification.permission
  })
  const remindedInSession = useRef(new Set())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const dueTasks = tasks.filter((task) => {
      const dueDate = getDueDate(task)
      return (
        dueDate &&
        !task.completed &&
        !task.notified &&
        dueDate.getTime() <= now.getTime() &&
        !remindedInSession.current.has(task.id)
      )
    })

    if (dueTasks.length === 0) return

    dueTasks.forEach((task) => remindedInSession.current.add(task.id))
    setActiveReminders((current) => {
      const currentIds = new Set(current.map((task) => task.id))
      const fresh = dueTasks.filter((task) => !currentIds.has(task.id))
      return [...fresh, ...current].slice(0, 4)
    })
    setTasks((current) =>
      current.map((task) =>
        dueTasks.some((dueTask) => dueTask.id === task.id)
          ? { ...task, notified: true }
          : task,
      ),
    )

    if (notificationPermission === 'granted') {
      dueTasks.forEach((task) => {
        new Notification('待办提醒', {
          body: `${task.title} 到时间了`,
          tag: task.id,
        })
      })
    }
  }, [notificationPermission, now, tasks])

  const stats = useMemo(() => {
    const openTasks = tasks.filter((task) => !task.completed)
    const overdue = openTasks.filter((task) => getTaskStatus(task, now).key === 'overdue')
    const today = openTasks.filter((task) => {
      const dueDate = getDueDate(task)
      return dueDate ? sameDay(dueDate, now) : false
    })
    const next = [...openTasks]
      .filter((task) => {
        const dueDate = getDueDate(task)
        return dueDate && dueDate.getTime() >= now.getTime()
      })
      .sort((first, second) => new Date(first.dueAt) - new Date(second.dueAt))[0]

    return {
      open: openTasks.length,
      overdue: overdue.length,
      today: today.length,
      done: tasks.length - openTasks.length,
      next,
    }
  }, [now, tasks])

  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return tasks
      .filter((task) => {
        const status = getTaskStatus(task, now)
        const dueDate = getDueDate(task)

        if (filter === 'done') return task.completed
        if (filter === 'overdue') return status.key === 'overdue'
        if (filter === 'today') return dueDate ? sameDay(dueDate, now) && !task.completed : false
        if (filter === 'upcoming') {
          return (
            !task.completed &&
            dueDate &&
            dueDate.getTime() >= now.getTime() &&
            dueDate.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000
          )
        }

        return true
      })
      .filter((task) => {
        if (!normalizedQuery) return true
        return `${task.title} ${task.note}`.toLowerCase().includes(normalizedQuery)
      })
      .sort((first, second) => {
        if (first.completed !== second.completed) return first.completed ? 1 : -1
        return new Date(first.dueAt) - new Date(second.dueAt)
      })
  }, [filter, now, query, tasks])

  async function requestNotifications() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
  }

  function handleSubmit(event) {
    event.preventDefault()
    const title = form.title.trim()
    if (!title) return

    const task = {
      id: crypto.randomUUID(),
      title,
      note: form.note.trim(),
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : '',
      priority: form.priority,
      completed: false,
      notified: false,
      createdAt: new Date().toISOString(),
    }

    setTasks((current) => [task, ...current])
    setForm(createBlankForm())
    setFilter('all')
  }

  function toggleTask(taskId) {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    )
    setActiveReminders((current) => current.filter((task) => task.id !== taskId))
  }

  function removeTask(taskId) {
    remindedInSession.current.delete(taskId)
    setTasks((current) => current.filter((task) => task.id !== taskId))
    setActiveReminders((current) => current.filter((task) => task.id !== taskId))
  }

  function dismissReminder(taskId) {
    setActiveReminders((current) => current.filter((task) => task.id !== taskId))
  }

  function snoozeTask(taskId, minutes) {
    const nextDueAt = getSnoozedDueAt(minutes)
    remindedInSession.current.delete(taskId)
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, dueAt: nextDueAt, completed: false, notified: false }
          : task,
      ),
    )
    dismissReminder(taskId)
  }

  const notificationLabel = {
    granted: '提醒已开',
    denied: '提醒关闭',
    default: '开启提醒',
    unsupported: '站内提醒',
  }[notificationPermission]

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ListChecks size={24} />
          </span>
          <div>
            <p className="eyebrow">React Todo Reminder</p>
            <h1>待办提醒</h1>
          </div>
        </div>

        <button
          className="action-button notification-button"
          type="button"
          onClick={requestNotifications}
          disabled={notificationPermission === 'granted' || notificationPermission === 'unsupported'}
        >
          {notificationPermission === 'granted' ? <BellRing size={18} /> : <Bell size={18} />}
          {notificationLabel}
        </button>
      </header>

      {activeReminders.length > 0 && (
        <section className="reminder-stack" aria-live="assertive">
          {activeReminders.map((task) => (
            <article className="reminder-alert" key={task.id}>
              <div className="reminder-icon" aria-hidden="true">
                <BellRing size={20} />
              </div>
              <div>
                <p className="reminder-title">{task.title}</p>
                <p className="reminder-time">{formatDueAt(task.dueAt)}</p>
              </div>
              <div className="reminder-actions">
                <button type="button" onClick={() => snoozeTask(task.id, 10)}>
                  <TimerReset size={16} />
                  10 分钟后
                </button>
                <button type="button" onClick={() => toggleTask(task.id)}>
                  <CheckCircle2 size={16} />
                  完成
                </button>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => dismissReminder(task.id)}
                  aria-label="关闭提醒"
                  title="关闭提醒"
                >
                  <X size={18} />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="stats-grid" aria-label="任务概览">
        <div className="stat-tile">
          <span>待办</span>
          <strong>{stats.open}</strong>
        </div>
        <div className="stat-tile accent">
          <span>今天</span>
          <strong>{stats.today}</strong>
        </div>
        <div className="stat-tile warning">
          <span>逾期</span>
          <strong>{stats.overdue}</strong>
        </div>
        <div className="stat-tile next">
          <span>下一项</span>
          <strong>{formatNextReminder(stats.next)}</strong>
        </div>
      </section>

      <section className="workspace">
        <form className="composer" onSubmit={handleSubmit}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">New Task</p>
              <h2>新建事项</h2>
            </div>
            <Clock3 size={22} aria-hidden="true" />
          </div>

          <label className="field">
            <span>事项</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="例如：给客户回邮件"
              maxLength="80"
            />
          </label>

          <label className="field">
            <span>提醒时间</span>
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
            />
          </label>

          <label className="field">
            <span>备注</span>
            <textarea
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              placeholder="补充地点、链接或小提醒"
              maxLength="180"
              rows="4"
            />
          </label>

          <div className="priority-picker" aria-label="优先级">
            {Object.entries(priorities).map(([id, priority]) => (
              <button
                className={form.priority === id ? 'selected' : ''}
                key={id}
                type="button"
                onClick={() => setForm({ ...form, priority: id })}
              >
                <span className={`priority-dot ${priority.color}`} />
                {priority.label}
              </button>
            ))}
          </div>

          <button className="submit-button" type="submit">
            <Plus size={18} />
            添加待办
          </button>
        </form>

        <section className="task-board" aria-label="待办列表">
          <div className="board-toolbar">
            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索事项"
              />
            </label>

            <div className="filter-tabs" role="tablist" aria-label="筛选待办">
              {filters.map((item) => (
                <button
                  aria-selected={filter === item.id}
                  className={filter === item.id ? 'active' : ''}
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="board-summary">
            <h2>任务列表</h2>
            <span>{visibleTasks.length} 项</span>
          </div>

          <div className="task-list">
            {visibleTasks.length === 0 ? (
              <div className="empty-state">
                <ListChecks size={34} />
                <h3>{tasks.length === 0 ? '还没有待办' : '没有匹配事项'}</h3>
                <p>{tasks.length === 0 ? '安排第一件事，提醒会在到点时弹出。' : '换个筛选或关键词。'}</p>
              </div>
            ) : (
              visibleTasks.map((task) => {
                const status = getTaskStatus(task, now)
                const priority = priorities[task.priority] ?? priorities.medium

                return (
                  <article className={`task-card ${status.key}`} key={task.id}>
                    <button
                      className="status-button"
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      aria-label={task.completed ? '标记为未完成' : '标记为完成'}
                      title={task.completed ? '标记为未完成' : '标记为完成'}
                    >
                      {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>

                    <div className="task-body">
                      <div className="task-head">
                        <h3>{task.title}</h3>
                        <span className={`priority-badge ${priority.color}`}>
                          {priority.short}
                        </span>
                      </div>

                      {task.note && <p className="task-note">{task.note}</p>}

                      <div className="task-meta">
                        <span>
                          <CalendarClock size={16} />
                          {formatDueAt(task.dueAt)}
                        </span>
                        <span className={`status-pill ${status.key}`}>{status.label}</span>
                      </div>
                    </div>

                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => removeTask(task.id)}
                      aria-label="删除待办"
                      title="删除待办"
                    >
                      <Trash2 size={18} />
                    </button>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
