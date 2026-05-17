import { useEffect, useMemo, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'habit-checkin-records'
const THEME_STORAGE_KEY = 'habit-checkin-theme'

type ViewName = 'today' | 'records' | 'trends'
type AppTheme = 'light' | 'dark'
type RecordViewMode = 'calendar' | 'details'

type CheckinForm = {
  date: string
  sleepHours: string
  sleepNote: string
  cardio: boolean
  cardioNote: string
  strength: boolean
  strengthNote: string
  meals: string
  mealsNote: string
  extraNote: string
}

const ENTRY_STEPS = ['sleep', 'cardio', 'strength', 'diet', 'supplement'] as const

type EntryStep = (typeof ENTRY_STEPS)[number]

const ENTRY_STEP_LABELS: Record<EntryStep, string> = {
  sleep: '睡眠',
  cardio: '有氧',
  strength: '力量',
  diet: '饮食',
  supplement: '补充',
}

type CheckinRecord = {
  date: string
  sleepHours: number | ''
  sleepNote: string
  cardio: boolean
  cardioNote: string
  strength: boolean
  strengthNote: string
  meals: number | ''
  mealsNote: string
  extraNote: string
}

type CalendarDay = {
  date: Date
  isoDate: string
  isCurrentMonth: boolean
  isToday: boolean
}

type HistoryMode = 'week' | 'month' | 'year'

type HistoryPeriodInfo = {
  label: string
  rangeLabel?: string
  startDate: string
  endDate: string
  emptyText: string
}

type TrendMetric = {
  label: string
  value: string
  change: string
  tone: 'up' | 'down' | 'flat' | 'neutral'
}

type TrendDayPoint = {
  date: string
  dayLabel: string
  monthIndex: number
  sleepHours: number | null
  hasRecord: boolean
  hasWorkout: boolean
}

type SleepChartPoint = {
  key: string
  label: string
  sleepHours: number | null
  showLabel: boolean
}

type TrendStats = {
  averageSleep: number | null
  currentStreak: number
  insights: string[]
  longestStreak: number
  metrics: TrendMetric[]
  missedDays: number
  period: HistoryPeriodInfo
  recordDays: number
  recordRate: number
  sleepVariance: number | null
  trendDays: TrendDayPoint[]
  workoutDays: number
  workoutRate: number
}

function getToday() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function normalizeDate(value: string) {
  const cleanedValue = value.trim().replaceAll('/', '-')
  const [year, month, day] = cleanedValue.split('-')

  if (!year || !month || !day) {
    return cleanedValue
  }

  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function getDateObject(date: string) {
  const [year, month, day] = normalizeDate(date).split('-').map(Number)

  return new Date(year, month - 1, day)
}

function getMonthTitle(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

function getShortDate(date: string) {
  const [, month, day] = normalizeDate(date).split('-')

  return `${month}月${day}日`
}

function getShiftedMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function getCalendarDays(monthDate: Date): CalendarDay[] {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7
  const startDate = new Date(year, month, 1 - mondayFirstOffset)
  const today = getToday()

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + index,
    )
    const isoDate = formatDate(date)

    return {
      date,
      isoDate,
      isCurrentMonth: date.getMonth() === month,
      isToday: isoDate === today,
    }
  })
}

function createEmptyForm(date = getToday()): CheckinForm {
  return {
    date,
    sleepHours: '',
    sleepNote: '',
    cardio: false,
    cardioNote: '',
    strength: false,
    strengthNote: '',
    meals: '',
    mealsNote: '',
    extraNote: '',
  }
}

function readStoredRecords(): CheckinRecord[] {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY)
    const parsedRecords = storedValue ? JSON.parse(storedValue) : []

    return Array.isArray(parsedRecords)
      ? (parsedRecords as CheckinRecord[]).map((record) => ({
          ...record,
          date: normalizeDate(record.date),
        }))
      : []
  } catch {
    return []
  }
}

function readStoredTheme(): AppTheme {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)?.trim()
    const normalizedTheme = storedTheme?.toLowerCase()

    if (normalizedTheme === 'light' || normalizedTheme === 'green') {
      return 'light'
    }

    if (
      normalizedTheme === 'dark' ||
      normalizedTheme === 'ableton' ||
      normalizedTheme === 'live dark' ||
      normalizedTheme === 'live-dark'
    ) {
      return 'dark'
    }

    if (storedTheme === '健康绿') {
      return 'light'
    }

    return 'dark'
  } catch {
    return 'dark'
  }
}

function sortRecords(records: CheckinRecord[]) {
  return [...records].sort((a, b) => b.date.localeCompare(a.date))
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function getWeekStart(date: Date) {
  const mondayFirstOffset = (date.getDay() + 6) % 7

  return addDays(date, -mondayFirstOffset)
}

function getPeriodStart(mode: HistoryMode, date: Date) {
  if (mode === 'week') {
    return getWeekStart(date)
  }

  if (mode === 'month') {
    return new Date(date.getFullYear(), date.getMonth(), 1)
  }

  return new Date(date.getFullYear(), 0, 1)
}

function getPeriodEnd(mode: HistoryMode, date: Date) {
  if (mode === 'week') {
    return addDays(getWeekStart(date), 6)
  }

  if (mode === 'month') {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0)
  }

  return new Date(date.getFullYear(), 11, 31)
}

function getIsoWeekNumber(date: Date) {
  const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayNumber = (currentDate.getDay() + 6) % 7

  currentDate.setDate(currentDate.getDate() - dayNumber + 3)

  const firstThursday = new Date(currentDate.getFullYear(), 0, 4)
  const firstThursdayDayNumber = (firstThursday.getDay() + 6) % 7

  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNumber + 3)

  return (
    1 +
    Math.round(
      (currentDate.getTime() - firstThursday.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    )
  )
}

function getIsoWeekYear(date: Date) {
  const currentDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayNumber = (currentDate.getDay() + 6) % 7

  currentDate.setDate(currentDate.getDate() - dayNumber + 3)

  return currentDate.getFullYear()
}

function formatRangeDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

function getHistoryPeriodInfo(
  mode: HistoryMode,
  periodDate: Date,
): HistoryPeriodInfo {
  const start = getPeriodStart(mode, periodDate)
  const end = getPeriodEnd(mode, periodDate)

  if (mode === 'week') {
    return {
      label: `${getIsoWeekYear(start)}年第${getIsoWeekNumber(start)}周`,
      rangeLabel: `${formatRangeDate(start)} - ${formatRangeDate(end)}`,
      startDate: formatDate(start),
      endDate: formatDate(end),
      emptyText: '本周暂无记录',
    }
  }

  if (mode === 'month') {
    return {
      label: getMonthTitle(start),
      startDate: formatDate(start),
      endDate: formatDate(end),
      emptyText: '本月暂无记录',
    }
  }

  return {
    label: `${start.getFullYear()}年`,
    startDate: formatDate(start),
    endDate: formatDate(end),
    emptyText: '本年暂无记录',
  }
}

function getEarliestRecordDate(records: CheckinRecord[]) {
  return records.reduce<Date | null>((earliestDate, record) => {
    const recordDate = getDateObject(record.date)

    return !earliestDate || recordDate < earliestDate ? recordDate : earliestDate
  }, null)
}

function getHistoryBoundaryStart(mode: HistoryMode, records: CheckinRecord[]) {
  const earliestRecordDate = getEarliestRecordDate(records) ?? getDateObject(getToday())

  return getPeriodStart(mode, earliestRecordDate)
}

function getHistoryBoundaryEnd(mode: HistoryMode) {
  return getPeriodStart(mode, getDateObject(getToday()))
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getCalendarMonthBoundaryStart(records: CheckinRecord[]) {
  const earliestRecordDate = getEarliestRecordDate(records) ?? getDateObject(getToday())

  return getMonthStart(earliestRecordDate)
}

function getCalendarMonthBoundaryEnd() {
  return getMonthStart(getDateObject(getToday()))
}

function clampCalendarMonth(monthDate: Date, records: CheckinRecord[]) {
  const minMonth = getCalendarMonthBoundaryStart(records)
  const maxMonth = getCalendarMonthBoundaryEnd()
  const targetMonth = getMonthStart(monthDate)

  if (targetMonth < minMonth) {
    return minMonth
  }

  if (targetMonth > maxMonth) {
    return maxMonth
  }

  return targetMonth
}

function canShiftCalendarMonth(
  monthDate: Date,
  records: CheckinRecord[],
  offset: number,
) {
  const minMonth = getCalendarMonthBoundaryStart(records)
  const maxMonth = getCalendarMonthBoundaryEnd()
  const targetMonth = getMonthStart(getShiftedMonth(monthDate, offset))

  return targetMonth >= minMonth && targetMonth <= maxMonth
}

function clampHistoryPeriodDate(
  mode: HistoryMode,
  periodDate: Date,
  records: CheckinRecord[],
) {
  const minStart = getHistoryBoundaryStart(mode, records)
  const maxStart = getHistoryBoundaryEnd(mode)
  const periodStart = getPeriodStart(mode, periodDate)

  if (periodStart < minStart) {
    return minStart
  }

  if (periodStart > maxStart) {
    return maxStart
  }

  return periodStart
}

function shiftHistoryPeriod(mode: HistoryMode, periodDate: Date, offset: number) {
  if (mode === 'week') {
    return addDays(periodDate, offset * 7)
  }

  if (mode === 'month') {
    return new Date(periodDate.getFullYear(), periodDate.getMonth() + offset, 1)
  }

  return new Date(periodDate.getFullYear() + offset, 0, 1)
}

function canShiftHistoryPeriod(
  mode: HistoryMode,
  periodDate: Date,
  records: CheckinRecord[],
  offset: number,
) {
  const minStart = getHistoryBoundaryStart(mode, records)
  const maxStart = getHistoryBoundaryEnd(mode)
  const targetStart = getPeriodStart(mode, shiftHistoryPeriod(mode, periodDate, offset))

  return targetStart >= minStart && targetStart <= maxStart
}

function filterRecordsByPeriod(records: CheckinRecord[], period: HistoryPeriodInfo) {
  return sortRecords(records).filter((record) => {
    const recordDate = normalizeDate(record.date)

    return recordDate >= period.startDate && recordDate <= period.endDate
  })
}

function getDaysInPeriod(period: HistoryPeriodInfo) {
  const startDate = getDateObject(period.startDate)
  const endDate = getDateObject(period.endDate)
  const days: string[] = []
  let cursorDate = startDate

  while (cursorDate <= endDate) {
    days.push(formatDate(cursorDate))
    cursorDate = addDays(cursorDate, 1)
  }

  return days
}

function getAverageSleep(records: CheckinRecord[]) {
  const sleepValues = records
    .map((record) => record.sleepHours)
    .filter((value): value is number => typeof value === 'number')

  if (sleepValues.length === 0) {
    return null
  }

  return sleepValues.reduce((total, value) => total + value, 0) / sleepValues.length
}

function getSleepVariance(records: CheckinRecord[]) {
  const sleepValues = records
    .map((record) => record.sleepHours)
    .filter((value): value is number => typeof value === 'number')

  if (sleepValues.length < 2) {
    return null
  }

  return Math.max(...sleepValues) - Math.min(...sleepValues)
}

function getLongestStreakInDates(dates: string[]) {
  let longestStreak = 0
  let currentStreak = 0

  dates.forEach((date) => {
    if (date) {
      currentStreak += 1
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  })

  return longestStreak
}

function getTrendMetricTone(delta: number | null) {
  if (delta === null) {
    return 'neutral'
  }

  if (delta > 0) {
    return 'up'
  }

  if (delta < 0) {
    return 'down'
  }

  return 'flat'
}

function formatTrendDelta(
  delta: number | null,
  unit: string,
  options: { decimals?: number } = {},
) {
  if (delta === null) {
    return '暂无对比'
  }

  if (Math.abs(delta) < 0.0001) {
    return '持平'
  }

  const decimals = options.decimals ?? 0
  const value = Number(Math.abs(delta).toFixed(decimals))

  return `${delta > 0 ? '+' : '-'}${value}${unit}`
}

function getPeriodNoun(mode: HistoryMode) {
  if (mode === 'week') {
    return '本周'
  }

  if (mode === 'month') {
    return '本月'
  }

  return '本年'
}

function getTrendStats(
  records: CheckinRecord[],
  mode: HistoryMode,
  periodDate: Date,
): TrendStats {
  const period = getHistoryPeriodInfo(mode, periodDate)
  const previousPeriod = getHistoryPeriodInfo(
    mode,
    shiftHistoryPeriod(mode, periodDate, -1),
  )
  const periodRecords = filterRecordsByPeriod(records, period)
  const previousRecords = filterRecordsByPeriod(records, previousPeriod)
  const recordsByDate = new Map(
    periodRecords.map((record) => [normalizeDate(record.date), record] as const),
  )
  const days = getDaysInPeriod(period)
  const recordDays = periodRecords.length
  const workoutDays = periodRecords.filter((record) => record.cardio || record.strength)
    .length
  const averageSleep = getAverageSleep(periodRecords)
  const previousAverageSleep = getAverageSleep(previousRecords)
  const recordRate = days.length > 0 ? recordDays / days.length : 0
  const workoutRate = days.length > 0 ? workoutDays / days.length : 0
  const sleepVariance = getSleepVariance(periodRecords)
  const periodNoun = getPeriodNoun(mode)
  const trendDays = days.map((date) => {
    const record = recordsByDate.get(date)
    const [, month, day] = date.split('-')

    return {
      date,
      dayLabel: `${Number(month)}/${Number(day)}`,
      monthIndex: Number(month) - 1,
      sleepHours: typeof record?.sleepHours === 'number' ? record.sleepHours : null,
      hasRecord: Boolean(record),
      hasWorkout: Boolean(record?.cardio || record?.strength),
    }
  })
  const longestStreak = getLongestStreakInDates(
    trendDays.map((day) => (day.hasRecord ? day.date : '')),
  )
  const previousRecordDays = previousRecords.length
  const previousWorkoutDays = previousRecords.filter(
    (record) => record.cardio || record.strength,
  ).length
  const recordDelta = previousRecords.length === 0 ? null : recordDays - previousRecordDays
  const workoutDelta =
    previousRecords.length === 0 ? null : workoutDays - previousWorkoutDays
  const sleepDelta =
    previousAverageSleep === null || averageSleep === null
      ? null
      : averageSleep - previousAverageSleep
  const currentStreak = getCurrentStreak(records)
  const insights = [
    recordDelta === null
      ? `${periodNoun}记录 ${recordDays} 天，继续积累后会有更清晰的对比。`
      : recordDelta > 0
        ? `${periodNoun}记录天数比上个周期多 ${recordDelta} 天。`
        : recordDelta < 0
          ? `${periodNoun}记录天数比上个周期少 ${Math.abs(recordDelta)} 天。`
          : `${periodNoun}记录天数与上个周期持平。`,
    sleepDelta === null
      ? '睡眠数据还不够多，先保持记录节奏。'
      : sleepDelta > 0
        ? `平均睡眠比上个周期增加 ${Number(sleepDelta.toFixed(1))} 小时。`
        : sleepDelta < 0
          ? `平均睡眠比上个周期减少 ${Number(Math.abs(sleepDelta).toFixed(1))} 小时。`
          : '平均睡眠与上个周期基本持平。',
    workoutDelta === null
      ? `${periodNoun}运动 ${workoutDays} 天。`
      : workoutDelta > 0
        ? `${periodNoun}运动天数比上个周期多 ${workoutDelta} 天。`
        : workoutDelta < 0
          ? `${periodNoun}运动频率比上个周期下降。`
          : `${periodNoun}运动频率与上个周期持平。`,
  ]

  if (currentStreak > 0) {
    insights.push(`当前已经连续记录 ${currentStreak} 天。`)
  }

  if (sleepVariance !== null && sleepVariance >= 2) {
    insights.push(`${periodNoun}睡眠波动较大，可以继续观察。`)
  }

  return {
    averageSleep,
    currentStreak,
    insights: insights.slice(0, 3),
    longestStreak,
    metrics: [
      {
        label: '记录天数',
        value: `${recordDays} 天`,
        change: formatTrendDelta(recordDelta, ' 天'),
        tone: getTrendMetricTone(recordDelta),
      },
      {
        label: '运动天数',
        value: `${workoutDays} 天`,
        change: formatTrendDelta(workoutDelta, ' 天'),
        tone: getTrendMetricTone(workoutDelta),
      },
      {
        label: '平均睡眠',
        value: formatAverage(averageSleep, ' 小时'),
        change: formatTrendDelta(sleepDelta, ' 小时', { decimals: 1 }),
        tone: getTrendMetricTone(sleepDelta),
      },
      {
        label: '连续记录',
        value: `${currentStreak} 天`,
        change: currentStreak > 0 ? '继续保持' : '从今天开始',
        tone: currentStreak > 0 ? 'up' : 'neutral',
      },
    ],
    missedDays: Math.max(days.length - recordDays, 0),
    period,
    recordDays,
    recordRate,
    sleepVariance,
    trendDays,
    workoutDays,
    workoutRate,
  }
}

function getTrendSummaryText(stats: TrendStats) {
  if (stats.recordRate >= 0.8 && stats.workoutRate >= 0.35) {
    return '本周期记录稳定，运动频率也不错。'
  }

  if (stats.recordRate >= 0.8) {
    return '本周期记录很稳定，继续保持。'
  }

  if (stats.missedDays > stats.recordDays) {
    return '本周期数据正在积累中。'
  }

  if (stats.sleepVariance !== null && stats.sleepVariance >= 2) {
    return '睡眠波动较大，可以继续观察。'
  }

  return '本周期状态正在积累，趋势会逐渐清晰。'
}

function getSleepChartPoints(mode: HistoryMode, days: TrendDayPoint[]) {
  if (mode === 'year') {
    return Array.from({ length: 12 }, (_, monthIndex): SleepChartPoint => {
      const monthDays = days.filter((day) => day.monthIndex === monthIndex)
      const sleepValues = monthDays
        .map((day) => day.sleepHours)
        .filter((value): value is number => value !== null)
      const averageSleep =
        sleepValues.length > 0
          ? sleepValues.reduce((total, value) => total + value, 0) / sleepValues.length
          : null

      return {
        key: `month-${monthIndex + 1}`,
        label: `${monthIndex + 1}月`,
        sleepHours: averageSleep,
        showLabel: [0, 2, 5, 8, 11].includes(monthIndex),
      }
    })
  }

  if (mode === 'month') {
    const lastIndex = Math.max(days.length - 1, 0)
    const labelIndexes = new Set([
      0,
      Math.round(lastIndex * 0.25),
      Math.round(lastIndex * 0.5),
      Math.round(lastIndex * 0.75),
      lastIndex,
    ])

    return days.map((day, index) => ({
      key: day.date,
      label: day.dayLabel,
      sleepHours: day.sleepHours,
      showLabel: labelIndexes.has(index),
    }))
  }

  const weekdays = ['一', '二', '三', '四', '五', '六', '日']

  return days.map((day, index) => ({
    key: day.date,
    label: weekdays[index] ?? day.dayLabel,
    sleepHours: day.sleepHours,
    showLabel: true,
  }))
}

function formatAverage(value: number | null, suffix: string) {
  return value === null ? '未填写' : `${Number(value.toFixed(1))}${suffix}`
}

function getCurrentStreak(records: CheckinRecord[]) {
  const recordDates = new Set(records.map((record) => normalizeDate(record.date)))
  let streakDays = 0
  let cursorDate = getDateObject(getToday())

  while (recordDates.has(formatDate(cursorDate))) {
    streakDays += 1
    cursorDate = addDays(cursorDate, -1)
  }

  return streakDays
}

function toFormRecord(record: CheckinRecord): CheckinForm {
  return {
    ...record,
    sleepHours: record.sleepHours === '' ? '' : String(record.sleepHours),
    meals: record.meals === '' ? '' : String(record.meals),
  }
}

function toSavedRecord(form: CheckinForm): CheckinRecord {
  return {
    ...form,
    sleepHours: form.sleepHours === '' ? '' : Number(form.sleepHours),
    meals: form.meals === '' ? '' : Number(form.meals),
  }
}

function formatValue(value: number | '', suffix: string) {
  return value === '' || value === undefined ? '未填写' : `${value}${suffix}`
}

function yesNo(value: boolean) {
  return value ? '是' : '否'
}

function getRecordTitle(record: CheckinRecord) {
  return `睡眠 ${formatValue(record.sleepHours, ' 小时')}`
}

function getRecordSummary(record: CheckinRecord) {
  return [
    record.cardio ? '有氧' : '无有氧',
    record.strength ? '力量' : '无力量',
    `饮食 ${formatValue(record.meals, ' 顿')}`,
  ].join(' · ')
}

function App() {
  const [activeView, setActiveView] = useState<ViewName>('today')
  const [recordViewMode, setRecordViewMode] = useState<RecordViewMode>('calendar')
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme())
  const [selectedDate, setSelectedDate] = useState(() => getToday())
  const [form, setForm] = useState(() => {
    const today = getToday()
    const existingRecord = readStoredRecords().find(
      (record) => normalizeDate(record.date) === today,
    )

    return existingRecord ? toFormRecord(existingRecord) : createEmptyForm(today)
  })
  const [records, setRecords] = useState(() => sortRecords(readStoredRecords()))
  const [expandedRecordDates, setExpandedRecordDates] = useState<Set<string>>(
    () => new Set(),
  )
  const [historyMode, setHistoryMode] = useState<HistoryMode>('month')
  const [historyPeriodDate, setHistoryPeriodDate] = useState(() =>
    getPeriodStart('month', getDateObject(getToday())),
  )
  const [trendMode, setTrendMode] = useState<HistoryMode>('month')
  const [trendPeriodDate, setTrendPeriodDate] = useState(() =>
    getPeriodStart('month', getDateObject(getToday())),
  )
  const [calendarMonth, setCalendarMonth] = useState(() =>
    getMonthStart(getDateObject(getToday())),
  )
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => getToday())
  const [message, setMessage] = useState('')
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [calendarDraftDate, setCalendarDraftDate] = useState(() => selectedDate)
  const [visibleMonth, setVisibleMonth] = useState(() => getDateObject(selectedDate))

  const summary = useMemo(() => {
    const total = records.length
    const cardioDays = records.filter((record) => record.cardio).length
    const strengthDays = records.filter((record) => record.strength).length

    return { total, cardioDays, strengthDays }
  }, [records])

  const recordsByDate = useMemo(
    () =>
      new Map(
        records.map((record) => [normalizeDate(record.date), record] as const),
      ),
    [records],
  )
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth])
  const recentRecords = useMemo(() => records.slice(0, 3), [records])
  const clampedHistoryPeriodDate = useMemo(
    () => clampHistoryPeriodDate(historyMode, historyPeriodDate, records),
    [historyMode, historyPeriodDate, records],
  )
  const historyPeriod = useMemo(
    () => getHistoryPeriodInfo(historyMode, clampedHistoryPeriodDate),
    [historyMode, clampedHistoryPeriodDate],
  )
  const historyRecords = useMemo(
    () => filterRecordsByPeriod(records, historyPeriod),
    [records, historyPeriod],
  )
  const canGoPreviousHistoryPeriod = useMemo(
    () => canShiftHistoryPeriod(historyMode, clampedHistoryPeriodDate, records, -1),
    [historyMode, clampedHistoryPeriodDate, records],
  )
  const canGoNextHistoryPeriod = useMemo(
    () => canShiftHistoryPeriod(historyMode, clampedHistoryPeriodDate, records, 1),
    [historyMode, clampedHistoryPeriodDate, records],
  )
  const clampedCalendarMonth = useMemo(
    () => clampCalendarMonth(calendarMonth, records),
    [calendarMonth, records],
  )
  const calendarPageDays = useMemo(
    () => getCalendarDays(clampedCalendarMonth),
    [clampedCalendarMonth],
  )
  const calendarSelectedRecord = useMemo(
    () => recordsByDate.get(normalizeDate(calendarSelectedDate)),
    [recordsByDate, calendarSelectedDate],
  )
  const clampedTrendPeriodDate = useMemo(
    () => clampHistoryPeriodDate(trendMode, trendPeriodDate, records),
    [trendMode, trendPeriodDate, records],
  )
  const trendStats = useMemo(
    () => getTrendStats(records, trendMode, clampedTrendPeriodDate),
    [records, trendMode, clampedTrendPeriodDate],
  )
  const canGoPreviousTrendPeriod = useMemo(
    () => canShiftHistoryPeriod(trendMode, clampedTrendPeriodDate, records, -1),
    [trendMode, clampedTrendPeriodDate, records],
  )
  const canGoNextTrendPeriod = useMemo(
    () => canShiftHistoryPeriod(trendMode, clampedTrendPeriodDate, records, 1),
    [trendMode, clampedTrendPeriodDate, records],
  )
  const canGoPreviousCalendarMonth = useMemo(
    () => canShiftCalendarMonth(clampedCalendarMonth, records, -1),
    [clampedCalendarMonth, records],
  )
  const canGoNextCalendarMonth = useMemo(
    () => canShiftCalendarMonth(clampedCalendarMonth, records, 1),
    [clampedCalendarMonth, records],
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Theme persistence is nice to have; the UI should still work without it.
    }
  }, [theme])

  function getFormForDate(date: string, sourceRecords = records) {
    const normalizedDate = normalizeDate(date)
    const existingRecord = sourceRecords.find(
      (record) => normalizeDate(record.date) === normalizedDate,
    )

    return existingRecord ? toFormRecord(existingRecord) : createEmptyForm(normalizedDate)
  }

  function updateField<Field extends keyof CheckinForm>(
    field: Field,
    value: CheckinForm[Field],
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setMessage('')
  }

  function switchView(view: ViewName) {
    if (view === 'records') {
      setRecordViewMode('calendar')
    }

    setActiveView(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function changeHistoryMode(mode: HistoryMode) {
    setHistoryMode(mode)
    setHistoryPeriodDate((currentDate) =>
      clampHistoryPeriodDate(mode, currentDate, records),
    )
  }

  function shiftVisibleHistoryPeriod(offset: number) {
    setHistoryPeriodDate((currentDate) =>
      clampHistoryPeriodDate(
        historyMode,
        shiftHistoryPeriod(historyMode, currentDate, offset),
        records,
      ),
    )
  }

  function changeTrendMode(mode: HistoryMode) {
    setTrendMode(mode)
    setTrendPeriodDate((currentDate) =>
      clampHistoryPeriodDate(mode, currentDate, records),
    )
  }

  function shiftVisibleTrendPeriod(offset: number) {
    setTrendPeriodDate((currentDate) =>
      clampHistoryPeriodDate(
        trendMode,
        shiftHistoryPeriod(trendMode, currentDate, offset),
        records,
      ),
    )
  }

  function shiftVisibleCalendarMonth(offset: number) {
    const nextMonth = clampCalendarMonth(
      getShiftedMonth(clampedCalendarMonth, offset),
      records,
    )
    const selectedDay = getDateObject(calendarSelectedDate).getDate()
    const lastDayOfNextMonth = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth() + 1,
      0,
    ).getDate()

    setCalendarMonth(nextMonth)
    setCalendarSelectedDate(
      formatDate(
        new Date(
          nextMonth.getFullYear(),
          nextMonth.getMonth(),
          Math.min(selectedDay, lastDayOfNextMonth),
        ),
      ),
    )
  }

  function selectCalendarDate(date: string) {
    const normalizedDate = normalizeDate(date)

    setCalendarSelectedDate(normalizedDate)
    setCalendarMonth(clampCalendarMonth(getDateObject(normalizedDate), records))
  }

  function fillSelectedCalendarDate() {
    changeSelectedDate(calendarSelectedDate)
    switchView('today')
  }

  function changeSelectedDate(value: string) {
    const normalizedDate = normalizeDate(value)

    setSelectedDate(normalizedDate)
    setForm(getFormForDate(normalizedDate))
    setMessage('')
  }

  function toggleRecordDetails(date: string) {
    const normalizedDate = normalizeDate(date)

    setExpandedRecordDates((currentDates) => {
      const nextDates = new Set(currentDates)

      if (nextDates.has(normalizedDate)) {
        nextDates.delete(normalizedDate)
      } else {
        nextDates.add(normalizedDate)
      }

      return nextDates
    })
  }

  function openCalendar() {
    const normalizedDate = normalizeDate(selectedDate || getToday())

    setCalendarDraftDate(normalizedDate)
    setVisibleMonth(getDateObject(normalizedDate))
    setIsCalendarOpen(true)
  }

  function cancelCalendar() {
    setIsCalendarOpen(false)
  }

  function confirmCalendar() {
    changeSelectedDate(calendarDraftDate)
    setIsCalendarOpen(false)
  }

  function pickCalendarDate(date: string) {
    const normalizedDate = normalizeDate(date)

    setCalendarDraftDate(normalizedDate)
    setVisibleMonth(getDateObject(normalizedDate))
  }

  function saveRecord() {
    const normalizedDate = normalizeDate(selectedDate)

    if (!normalizedDate) {
      setMessage('请先选择或填写日期。')
      return
    }

    const savedRecord = toSavedRecord({
      ...form,
      date: normalizedDate,
    })
    const nextRecords = sortRecords([
      savedRecord,
      ...records.filter((record) => normalizeDate(record.date) !== savedRecord.date),
    ])

    setRecords(nextRecords)
    setForm(toFormRecord(savedRecord))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords))
    setMessage(`${savedRecord.date} 的记录已保存。`)
  }

  function loadRecordForEdit(record: CheckinRecord) {
    const normalizedDate = normalizeDate(record.date)

    setSelectedDate(normalizedDate)
    setForm(toFormRecord({ ...record, date: normalizedDate }))
    setActiveView('today')
    setMessage(`${normalizedDate} 的记录已加载，可以继续修改。`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function deleteRecord(date: string) {
    const normalizedDate = normalizeDate(date)
    const nextRecords = records.filter(
      (record) => normalizeDate(record.date) !== normalizedDate,
    )

    setRecords(nextRecords)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords))
    setExpandedRecordDates((currentDates) => {
      const nextDates = new Set(currentDates)
      nextDates.delete(normalizedDate)
      return nextDates
    })

    if (normalizeDate(selectedDate) === normalizedDate) {
      setForm(createEmptyForm(normalizeDate(selectedDate)))
    }

    setMessage(`${normalizedDate} 的记录已删除。`)
  }

  function resetForm() {
    const normalizedDate = normalizeDate(selectedDate || getToday())

    setSelectedDate(normalizedDate)
    setForm(createEmptyForm(normalizedDate))
    setMessage('已清空表单，可以重新填写当前日期的记录。')
  }

  return (
    <AppShell
      activeView={activeView}
      isCalendarOpen={isCalendarOpen}
      theme={theme}
      calendar={
        <CalendarDialog
          calendarDays={calendarDays}
          calendarDraftDate={calendarDraftDate}
          recordsByDate={recordsByDate}
          visibleMonth={visibleMonth}
          onCancel={cancelCalendar}
          onConfirm={confirmCalendar}
          onMonthChange={(offset) =>
            setVisibleMonth((currentMonth) => getShiftedMonth(currentMonth, offset))
          }
          onPickDate={pickCalendarDate}
        />
      }
      onThemeChange={setTheme}
      onNavigate={switchView}
    >
      {activeView === 'today' ? (
        <HomePage
          form={form}
          message={message}
          recentRecords={recentRecords}
          selectedDate={selectedDate}
          summary={summary}
          onDeleteRecord={deleteRecord}
          onEditRecord={loadRecordForEdit}
          onOpenCalendar={openCalendar}
          onResetForm={resetForm}
          onSaveRecord={saveRecord}
          onUpdateField={updateField}
          onViewAll={() => switchView('records')}
        />
      ) : activeView === 'records' ? (
        <RecordPage
          canGoNext={canGoNextHistoryPeriod}
          canGoNextMonth={canGoNextCalendarMonth}
          canGoPrevious={canGoPreviousHistoryPeriod}
          canGoPreviousMonth={canGoPreviousCalendarMonth}
          calendarDays={calendarPageDays}
          calendarMonth={clampedCalendarMonth}
          calendarSelectedDate={calendarSelectedDate}
          calendarSelectedRecord={calendarSelectedRecord}
          expandedRecordDates={expandedRecordDates}
          mode={historyMode}
          period={historyPeriod}
          recordViewMode={recordViewMode}
          records={historyRecords}
          recordsByDate={recordsByDate}
          onDeleteRecord={deleteRecord}
          onEditRecord={loadRecordForEdit}
          onFillDate={fillSelectedCalendarDate}
          onModeChange={changeHistoryMode}
          onMonthShift={shiftVisibleCalendarMonth}
          onPeriodShift={shiftVisibleHistoryPeriod}
          onRecordViewModeChange={setRecordViewMode}
          onSelectCalendarDate={selectCalendarDate}
          onToggleDetails={toggleRecordDetails}
        />
      ) : activeView === 'trends' ? (
        <TrendsPage
          canGoNext={canGoNextTrendPeriod}
          canGoPrevious={canGoPreviousTrendPeriod}
          mode={trendMode}
          stats={trendStats}
          onModeChange={changeTrendMode}
          onPeriodShift={shiftVisibleTrendPeriod}
        />
      ) : null}
    </AppShell>
  )
}

function AppShell({
  activeView,
  calendar,
  children,
  isCalendarOpen,
  theme,
  onNavigate,
  onThemeChange,
}: {
  activeView: ViewName
  calendar: React.ReactNode
  children: React.ReactNode
  isCalendarOpen: boolean
  theme: AppTheme
  onNavigate: (view: ViewName) => void
  onThemeChange: (theme: AppTheme) => void
}) {
  return (
    <main className="app-shell" data-theme={theme}>
      <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
      {children}
      <BottomNav activeView={activeView} onNavigate={onNavigate} />
      {isCalendarOpen && calendar}
    </main>
  )
}

function ThemeSwitcher({
  theme,
  onThemeChange,
}: {
  theme: AppTheme
  onThemeChange: (theme: AppTheme) => void
}) {
  return (
    <div className="theme-switcher" aria-label="主题切换">
      <button
        className={theme === 'dark' ? 'theme-option is-active' : 'theme-option'}
        type="button"
        onClick={() => onThemeChange('dark')}
      >
        Dark
      </button>
      <button
        className={theme === 'light' ? 'theme-option is-active' : 'theme-option'}
        type="button"
        onClick={() => onThemeChange('light')}
      >
        Light
      </button>
    </div>
  )
}

function HomePage({
  form,
  message,
  recentRecords,
  selectedDate,
  summary,
  onDeleteRecord,
  onEditRecord,
  onOpenCalendar,
  onResetForm,
  onSaveRecord,
  onUpdateField,
  onViewAll,
}: {
  form: CheckinForm
  message: string
  recentRecords: CheckinRecord[]
  selectedDate: string
  summary: { total: number; cardioDays: number; strengthDays: number }
  onDeleteRecord: (date: string) => void
  onEditRecord: (record: CheckinRecord) => void
  onOpenCalendar: () => void
  onResetForm: () => void
  onSaveRecord: () => void
  onUpdateField: <Field extends keyof CheckinForm>(
    field: Field,
    value: CheckinForm[Field],
  ) => void
  onViewAll: () => void
}) {
  return (
    <div className="page-stack">
      <HomeHeader summary={summary} />

      {message && <div className="notice">{message}</div>}

      <CheckinFormCard
        form={form}
        selectedDate={selectedDate}
        onOpenCalendar={onOpenCalendar}
        onResetForm={onResetForm}
        onSaveRecord={onSaveRecord}
        onUpdateField={onUpdateField}
      />

      <HistoryPreview
        records={recentRecords}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
        onViewAll={onViewAll}
      />
    </div>
  )
}

function HomeHeader({
  summary,
}: {
  summary: { total: number; cardioDays: number; strengthDays: number }
}) {
  return (
    <header className="home-hero">
      <p className="eyebrow">Habit Check-in</p>
      <h1>今日状态</h1>
      <p>快速记录睡眠、运动和饮食，给每天留下一点可回看的线索。</p>
      <div className="metric-row" aria-label="打卡概览">
        <div className="metric-pill">
          <strong>{summary.total}</strong>
          <span>记录</span>
        </div>
        <div className="metric-pill">
          <strong>{summary.cardioDays}</strong>
          <span>有氧</span>
        </div>
        <div className="metric-pill">
          <strong>{summary.strengthDays}</strong>
          <span>力量</span>
        </div>
      </div>
    </header>
  )
}

function CheckinFormCard({
  form,
  selectedDate,
  onOpenCalendar,
  onResetForm,
  onSaveRecord,
  onUpdateField,
}: {
  form: CheckinForm
  selectedDate: string
  onOpenCalendar: () => void
  onResetForm: () => void
  onSaveRecord: () => void
  onUpdateField: <Field extends keyof CheckinForm>(
    field: Field,
    value: CheckinForm[Field],
  ) => void
}) {
  const [activeStep, setActiveStep] = useState<EntryStep>('sleep')
  const activeStepIndex = ENTRY_STEPS.indexOf(activeStep)

  function goToStep(step: EntryStep) {
    setActiveStep(step)
  }

  function shiftStep(offset: number) {
    const nextIndex = Math.min(
      Math.max(activeStepIndex + offset, 0),
      ENTRY_STEPS.length - 1,
    )

    setActiveStep(ENTRY_STEPS[nextIndex])
  }

  return (
    <form className="app-card checkin-card" onSubmit={(event) => event.preventDefault()}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">今日填写</p>
          <h2>状态记录</h2>
        </div>
        <button className="ghost-button compact" type="button" onClick={onResetForm}>
          清空
        </button>
      </div>

      <label className="field">
        <span>日期</span>
        <button className="date-picker-button" type="button" onClick={onOpenCalendar}>
          <span>{selectedDate}</span>
          <strong>选择日期</strong>
        </button>
      </label>

      <EntryStepTabs activeStep={activeStep} onStepChange={goToStep} />

      <EntryStepCard
        activeStep={activeStep}
        form={form}
        onUpdateField={onUpdateField}
      />

      <EntryStepControls
        activeStepIndex={activeStepIndex}
        onDotClick={(index) => setActiveStep(ENTRY_STEPS[index])}
        onNext={() => shiftStep(1)}
        onPrevious={() => shiftStep(-1)}
      />

      <button className="primary-button save-button" type="button" onClick={onSaveRecord}>
        保存今日记录
      </button>
    </form>
  )
}

function EntryStepTabs({
  activeStep,
  onStepChange,
}: {
  activeStep: EntryStep
  onStepChange: (step: EntryStep) => void
}) {
  return (
    <div className="entry-step-tabs" role="tablist" aria-label="填写模块">
      {ENTRY_STEPS.map((step) => (
        <button
          className={activeStep === step ? 'entry-step-tab is-active' : 'entry-step-tab'}
          type="button"
          key={step}
          role="tab"
          aria-selected={activeStep === step}
          onClick={() => onStepChange(step)}
        >
          {ENTRY_STEP_LABELS[step]}
        </button>
      ))}
    </div>
  )
}

function EntryStepCard({
  activeStep,
  form,
  onUpdateField,
}: {
  activeStep: EntryStep
  form: CheckinForm
  onUpdateField: <Field extends keyof CheckinForm>(
    field: Field,
    value: CheckinForm[Field],
  ) => void
}) {
  if (activeStep === 'sleep') {
    return <SleepEntryCard form={form} onUpdateField={onUpdateField} />
  }

  if (activeStep === 'cardio') {
    return <CardioEntryCard form={form} onUpdateField={onUpdateField} />
  }

  if (activeStep === 'strength') {
    return <StrengthEntryCard form={form} onUpdateField={onUpdateField} />
  }

  if (activeStep === 'diet') {
    return <DietEntryCard form={form} onUpdateField={onUpdateField} />
  }

  return <SupplementEntryCard form={form} onUpdateField={onUpdateField} />
}

function EntryCardHeader({
  title,
}: {
  title: string
}) {
  return (
    <div className="entry-card-header">
      <h3>{title}</h3>
    </div>
  )
}

function SleepEntryCard({
  form,
  onUpdateField,
}: {
  form: CheckinForm
  onUpdateField: <Field extends keyof CheckinForm>(
    field: Field,
    value: CheckinForm[Field],
  ) => void
}) {
  return (
    <section className="entry-step-card">
      <EntryCardHeader title="睡眠" />
      <label className="field">
        <span>睡眠时间</span>
        <div className="input-with-unit">
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            placeholder="例如 7.5"
            value={form.sleepHours}
            onChange={(event) => onUpdateField('sleepHours', event.target.value)}
          />
          <strong>小时</strong>
        </div>
      </label>
      <label className="field">
        <span>睡眠附录</span>
        <textarea
          rows={4}
          placeholder="例如：昨晚入睡较晚，中途醒了一次"
          value={form.sleepNote}
          onChange={(event) => onUpdateField('sleepNote', event.target.value)}
        />
      </label>
    </section>
  )
}

function CardioEntryCard({
  form,
  onUpdateField,
}: {
  form: CheckinForm
  onUpdateField: <Field extends keyof CheckinForm>(
    field: Field,
    value: CheckinForm[Field],
  ) => void
}) {
  return (
    <section className="entry-step-card">
      <EntryCardHeader title="有氧" />
      <div className="field">
        <span>有氧运动</span>
        <div className="choice-row" role="group" aria-label="是否做了有氧运动">
          <button
            className={form.cardio ? 'choice is-active' : 'choice'}
            type="button"
            onClick={() => onUpdateField('cardio', true)}
          >
            是
          </button>
          <button
            className={!form.cardio ? 'choice is-active' : 'choice'}
            type="button"
            onClick={() => onUpdateField('cardio', false)}
          >
            否
          </button>
        </div>
      </div>
      <label className="field">
        <span>有氧附录</span>
        <textarea
          rows={4}
          placeholder="例如：慢跑 30 分钟，强度中等"
          value={form.cardioNote}
          onChange={(event) => onUpdateField('cardioNote', event.target.value)}
        />
      </label>
    </section>
  )
}

function StrengthEntryCard({
  form,
  onUpdateField,
}: {
  form: CheckinForm
  onUpdateField: <Field extends keyof CheckinForm>(
    field: Field,
    value: CheckinForm[Field],
  ) => void
}) {
  return (
    <section className="entry-step-card">
      <EntryCardHeader title="力量" />
      <div className="field">
        <span>力量训练</span>
        <div className="choice-row" role="group" aria-label="是否进行了力量训练">
          <button
            className={form.strength ? 'choice is-active' : 'choice'}
            type="button"
            onClick={() => onUpdateField('strength', true)}
          >
            是
          </button>
          <button
            className={!form.strength ? 'choice is-active' : 'choice'}
            type="button"
            onClick={() => onUpdateField('strength', false)}
          >
            否
          </button>
        </div>
      </div>
      <label className="field">
        <span>力量训练附录</span>
        <textarea
          rows={4}
          placeholder="例如：练了胸和三头，整体状态不错"
          value={form.strengthNote}
          onChange={(event) => onUpdateField('strengthNote', event.target.value)}
        />
      </label>
    </section>
  )
}

function DietEntryCard({
  form,
  onUpdateField,
}: {
  form: CheckinForm
  onUpdateField: <Field extends keyof CheckinForm>(
    field: Field,
    value: CheckinForm[Field],
  ) => void
}) {
  return (
    <section className="entry-step-card">
      <EntryCardHeader title="饮食" />
      <label className="field">
        <span>饮食记录</span>
        <div className="input-with-unit">
          <input
            type="number"
            min="0"
            step="1"
            placeholder="例如 3"
            value={form.meals}
            onChange={(event) => onUpdateField('meals', event.target.value)}
          />
          <strong>顿</strong>
        </div>
      </label>
      <label className="field">
        <span>饮食附录</span>
        <textarea
          rows={4}
          placeholder="例如：早餐没吃，午饭和晚饭正常"
          value={form.mealsNote}
          onChange={(event) => onUpdateField('mealsNote', event.target.value)}
        />
      </label>
    </section>
  )
}

function SupplementEntryCard({
  form,
  onUpdateField,
}: {
  form: CheckinForm
  onUpdateField: <Field extends keyof CheckinForm>(
    field: Field,
    value: CheckinForm[Field],
  ) => void
}) {
  return (
    <section className="entry-step-card supplement-step-card">
      <EntryCardHeader title="补充" />
      <label className="field field-without-label">
        <textarea
          rows={6}
          placeholder="补充点额外信息或写点今日随想吧"
          value={form.extraNote}
          onChange={(event) => onUpdateField('extraNote', event.target.value)}
        />
      </label>
    </section>
  )
}

function EntryStepControls({
  activeStepIndex,
  onDotClick,
  onNext,
  onPrevious,
}: {
  activeStepIndex: number
  onDotClick: (index: number) => void
  onNext: () => void
  onPrevious: () => void
}) {
  const isFirstStep = activeStepIndex === 0
  const isLastStep = activeStepIndex === ENTRY_STEPS.length - 1

  return (
    <div className="entry-step-controls">
      <button
        className="step-arrow-button"
        type="button"
        aria-label="上一项"
        disabled={isFirstStep}
        onClick={onPrevious}
      >
        <span className="entry-nav-icon" aria-hidden="true">
          ‹
        </span>
      </button>

      <div className="entry-progress-dots" aria-label="填写进度">
        {ENTRY_STEPS.map((step, index) => (
          <button
            className={index === activeStepIndex ? 'entry-dot is-active' : 'entry-dot'}
            type="button"
            key={step}
            aria-label={`切换到${ENTRY_STEP_LABELS[step]}`}
            aria-current={index === activeStepIndex ? 'step' : undefined}
            onClick={() => onDotClick(index)}
          />
        ))}
      </div>

      <button
        className="step-arrow-button"
        type="button"
        aria-label="下一项"
        disabled={isLastStep}
        onClick={onNext}
      >
        <span className="entry-nav-icon" aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  )
}

function HistoryPreview({
  records,
  onDeleteRecord,
  onEditRecord,
  onViewAll,
}: {
  records: CheckinRecord[]
  onDeleteRecord: (date: string) => void
  onEditRecord: (record: CheckinRecord) => void
  onViewAll: () => void
}) {
  return (
    <section className="app-card history-preview">
      <div className="section-heading">
        <div>
          <p className="eyebrow">最近</p>
          <h2>最近记录</h2>
        </div>
        <button className="text-link" type="button" onClick={onViewAll}>
          查看记录 &gt;
        </button>
      </div>

      {records.length === 0 ? (
        <EmptyState text="保存记录后，最近状态会出现在这里。" />
      ) : (
        <div className="compact-list">
          {records.map((record) => (
            <HistoryRecordItem
              compact
              isExpanded={false}
              key={record.date}
              record={record}
              onDeleteRecord={onDeleteRecord}
              onEditRecord={onEditRecord}
              onToggleDetails={() => onViewAll()}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function RecordPage({
  canGoNext,
  canGoNextMonth,
  canGoPrevious,
  canGoPreviousMonth,
  calendarDays,
  calendarMonth,
  calendarSelectedDate,
  calendarSelectedRecord,
  expandedRecordDates,
  mode,
  period,
  recordViewMode,
  records,
  recordsByDate,
  onDeleteRecord,
  onEditRecord,
  onFillDate,
  onModeChange,
  onMonthShift,
  onPeriodShift,
  onRecordViewModeChange,
  onSelectCalendarDate,
  onToggleDetails,
}: {
  canGoNext: boolean
  canGoNextMonth: boolean
  canGoPrevious: boolean
  canGoPreviousMonth: boolean
  calendarDays: CalendarDay[]
  calendarMonth: Date
  calendarSelectedDate: string
  calendarSelectedRecord?: CheckinRecord
  expandedRecordDates: Set<string>
  mode: HistoryMode
  period: HistoryPeriodInfo
  recordViewMode: RecordViewMode
  records: CheckinRecord[]
  recordsByDate: Map<string, CheckinRecord>
  onDeleteRecord: (date: string) => void
  onEditRecord: (record: CheckinRecord) => void
  onFillDate: () => void
  onModeChange: (mode: HistoryMode) => void
  onMonthShift: (offset: number) => void
  onPeriodShift: (offset: number) => void
  onRecordViewModeChange: (mode: RecordViewMode) => void
  onSelectCalendarDate: (date: string) => void
  onToggleDetails: (date: string) => void
}) {
  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="eyebrow">Records</p>
        <h1>记录</h1>
        <p>用月历查看打卡状态，或切到明细回看过去记录。</p>
      </header>

      <RecordViewSwitcher
        mode={recordViewMode}
        onModeChange={onRecordViewModeChange}
      />

      {recordViewMode === 'calendar' ? (
        <RecordCalendarView
          canGoNext={canGoNextMonth}
          canGoPrevious={canGoPreviousMonth}
          days={calendarDays}
          monthDate={calendarMonth}
          recordsByDate={recordsByDate}
          selectedDate={calendarSelectedDate}
          selectedRecord={calendarSelectedRecord}
          onEditRecord={onEditRecord}
          onFillDate={onFillDate}
          onMonthShift={onMonthShift}
          onSelectDate={onSelectCalendarDate}
        />
      ) : (
        <RecordDetailsView
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          expandedRecordDates={expandedRecordDates}
          mode={mode}
          period={period}
          records={records}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
          onModeChange={onModeChange}
          onPeriodShift={onPeriodShift}
          onToggleDetails={onToggleDetails}
        />
      )}
    </div>
  )
}

function RecordViewSwitcher({
  mode,
  onModeChange,
}: {
  mode: RecordViewMode
  onModeChange: (mode: RecordViewMode) => void
}) {
  const modes: { label: string; value: RecordViewMode }[] = [
    { label: '月历', value: 'calendar' },
    { label: '明细', value: 'details' },
  ]

  return (
    <section className="app-card record-view-card">
      <div className="record-view-switcher" role="tablist" aria-label="记录查看方式">
        {modes.map((item) => (
          <button
            className={mode === item.value ? 'mode-option is-active' : 'mode-option'}
            type="button"
            key={item.value}
            role="tab"
            aria-selected={mode === item.value}
            onClick={() => onModeChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function RecordDetailsView({
  canGoNext,
  canGoPrevious,
  expandedRecordDates,
  mode,
  period,
  records,
  onDeleteRecord,
  onEditRecord,
  onModeChange,
  onPeriodShift,
  onToggleDetails,
}: {
  canGoNext: boolean
  canGoPrevious: boolean
  expandedRecordDates: Set<string>
  mode: HistoryMode
  period: HistoryPeriodInfo
  records: CheckinRecord[]
  onDeleteRecord: (date: string) => void
  onEditRecord: (record: CheckinRecord) => void
  onModeChange: (mode: HistoryMode) => void
  onPeriodShift: (offset: number) => void
  onToggleDetails: (date: string) => void
}) {
  return (
    <>
      <section className="app-card history-control-card">
        <HistoryModeSwitcher mode={mode} onModeChange={onModeChange} />
        <HistoryPeriodNavigator
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          period={period}
          onPeriodShift={onPeriodShift}
        />
      </section>

      <HistoryRecordList
        emptyText={period.emptyText}
        expandedRecordDates={expandedRecordDates}
        records={records}
        onDeleteRecord={onDeleteRecord}
        onEditRecord={onEditRecord}
        onToggleDetails={onToggleDetails}
      />
    </>
  )
}

function HistoryModeSwitcher({
  mode,
  onModeChange,
}: {
  mode: HistoryMode
  onModeChange: (mode: HistoryMode) => void
}) {
  const modes: { label: string; value: HistoryMode }[] = [
    { label: '周', value: 'week' },
    { label: '月', value: 'month' },
    { label: '年', value: 'year' },
  ]

  return (
    <div className="history-mode-switcher" role="tablist" aria-label="历史时间维度">
      {modes.map((item) => (
        <button
          className={mode === item.value ? 'mode-option is-active' : 'mode-option'}
          type="button"
          key={item.value}
          role="tab"
          aria-selected={mode === item.value}
          onClick={() => onModeChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function HistoryPeriodNavigator({
  canGoNext,
  canGoPrevious,
  period,
  onPeriodShift,
}: {
  canGoNext: boolean
  canGoPrevious: boolean
  period: HistoryPeriodInfo
  onPeriodShift: (offset: number) => void
}) {
  return (
    <div className="history-period-nav">
      <button
        className="period-arrow"
        type="button"
        aria-label="上一个时间窗口"
        disabled={!canGoPrevious}
        onClick={() => onPeriodShift(-1)}
      >
        ‹
      </button>

      <div className="period-title">
        <strong>{period.label}</strong>
        {period.rangeLabel && <span>{period.rangeLabel}</span>}
      </div>

      <button
        className="period-arrow"
        type="button"
        aria-label="下一个时间窗口"
        disabled={!canGoNext}
        onClick={() => onPeriodShift(1)}
      >
        ›
      </button>
    </div>
  )
}

function HistoryRecordList({
  emptyText,
  expandedRecordDates,
  records,
  onDeleteRecord,
  onEditRecord,
  onToggleDetails,
}: {
  emptyText: string
  expandedRecordDates: Set<string>
  records: CheckinRecord[]
  onDeleteRecord: (date: string) => void
  onEditRecord: (record: CheckinRecord) => void
  onToggleDetails: (date: string) => void
}) {
  if (records.length === 0) {
    return (
      <section className="app-card">
        <EmptyState text={emptyText} />
      </section>
    )
  }

  return (
    <div className="history-list">
      {records.map((record) => {
        const normalizedDate = normalizeDate(record.date)

        return (
          <HistoryRecordItem
            isExpanded={expandedRecordDates.has(normalizedDate)}
            key={normalizedDate}
            record={record}
            onDeleteRecord={onDeleteRecord}
            onEditRecord={onEditRecord}
            onToggleDetails={onToggleDetails}
          />
        )
      })}
    </div>
  )
}

function HistoryRecordItem({
  compact = false,
  isExpanded,
  record,
  onDeleteRecord,
  onEditRecord,
  onToggleDetails,
}: {
  compact?: boolean
  isExpanded: boolean
  record: CheckinRecord
  onDeleteRecord: (date: string) => void
  onEditRecord: (record: CheckinRecord) => void
  onToggleDetails: (date: string) => void
}) {
  return (
    <article className={compact ? 'record-row is-compact' : 'record-row'}>
      <button
        className="record-summary-button"
        type="button"
        onClick={() => onToggleDetails(record.date)}
      >
        <span className="record-date-badge">{getShortDate(record.date)}</span>
        <span className="record-summary-text">
          <strong>{getRecordTitle(record)}</strong>
          <small>{getRecordSummary(record)}</small>
        </span>
        <span className={isExpanded ? 'record-arrow is-open' : 'record-arrow'}>›</span>
      </button>

      {isExpanded && !compact && (
        <HistoryRecordDetail
          record={record}
          onDeleteRecord={onDeleteRecord}
          onEditRecord={onEditRecord}
        />
      )}
    </article>
  )
}

function HistoryRecordDetail({
  record,
  onDeleteRecord,
  onEditRecord,
}: {
  record: CheckinRecord
  onDeleteRecord: (date: string) => void
  onEditRecord: (record: CheckinRecord) => void
}) {
  return (
    <div className="record-detail">
      <div className="detail-grid">
        <DetailItem label="日期" value={record.date} />
        <DetailItem label="睡眠时间" value={formatValue(record.sleepHours, ' 小时')} />
        <DetailItem label="有氧运动" value={yesNo(record.cardio)} />
        <DetailItem label="力量训练" value={yesNo(record.strength)} />
        <DetailItem label="饮食记录" value={formatValue(record.meals, ' 顿')} />
      </div>

      <div className="note-list">
        <DetailNote label="睡眠附录" value={record.sleepNote} />
        <DetailNote label="有氧附录" value={record.cardioNote} />
        <DetailNote label="力量附录" value={record.strengthNote} />
        <DetailNote label="饮食附录" value={record.mealsNote} />
        <DetailNote label="额外补充" value={record.extraNote} />
      </div>

      <div className="record-actions">
        <button className="ghost-button" type="button" onClick={() => onEditRecord(record)}>
          编辑
        </button>
        <button
          className="danger-button"
          type="button"
          onClick={() => onDeleteRecord(record.date)}
        >
          删除
        </button>
      </div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function DetailNote({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <strong>{label}：</strong>
      {value || '无'}
    </p>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <h3>暂无记录</h3>
      <p>{text}</p>
    </div>
  )
}

function RecordCalendarView({
  canGoNext,
  canGoPrevious,
  days,
  monthDate,
  recordsByDate,
  selectedDate,
  selectedRecord,
  onEditRecord,
  onFillDate,
  onMonthShift,
  onSelectDate,
}: {
  canGoNext: boolean
  canGoPrevious: boolean
  days: CalendarDay[]
  monthDate: Date
  recordsByDate: Map<string, CheckinRecord>
  selectedDate: string
  selectedRecord?: CheckinRecord
  onEditRecord: (record: CheckinRecord) => void
  onFillDate: () => void
  onMonthShift: (offset: number) => void
  onSelectDate: (date: string) => void
}) {
  return (
    <>
      <section className="app-card month-calendar-card">
        <MonthNavigator
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          monthDate={monthDate}
          onMonthShift={onMonthShift}
        />
        <MonthCalendarGrid
          days={days}
          recordsByDate={recordsByDate}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
      </section>

      <SelectedDateDetailCard
        record={selectedRecord}
        selectedDate={selectedDate}
        onEditRecord={onEditRecord}
        onFillDate={onFillDate}
      />
    </>
  )
}

function MonthNavigator({
  canGoNext,
  canGoPrevious,
  monthDate,
  onMonthShift,
}: {
  canGoNext: boolean
  canGoPrevious: boolean
  monthDate: Date
  onMonthShift: (offset: number) => void
}) {
  return (
    <div className="month-navigator">
      <button
        className="period-arrow"
        type="button"
        aria-label="上个月"
        disabled={!canGoPrevious}
        onClick={() => onMonthShift(-1)}
      >
        ‹
      </button>
      <strong>{getMonthTitle(monthDate)}</strong>
      <button
        className="period-arrow"
        type="button"
        aria-label="下个月"
        disabled={!canGoNext}
        onClick={() => onMonthShift(1)}
      >
        ›
      </button>
    </div>
  )
}

function MonthCalendarGrid({
  days,
  recordsByDate,
  selectedDate,
  onSelectDate,
}: {
  days: CalendarDay[]
  recordsByDate: Map<string, CheckinRecord>
  selectedDate: string
  onSelectDate: (date: string) => void
}) {
  return (
    <div className="month-calendar">
      <div className="calendar-weekdays" aria-hidden="true">
        {['一', '二', '三', '四', '五', '六', '日'].map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="month-calendar-grid">
        {days.map((day) => {
          const record = recordsByDate.get(day.isoDate)
          const hasWorkout = Boolean(record?.cardio || record?.strength)

          return (
            <CalendarDayCell
              day={day}
              hasRecord={Boolean(record)}
              hasWorkout={hasWorkout}
              isSelected={day.isoDate === selectedDate}
              key={day.isoDate}
              onSelectDate={onSelectDate}
            />
          )
        })}
      </div>

      <CalendarLegend />
    </div>
  )
}

function CalendarDayCell({
  day,
  hasRecord,
  hasWorkout,
  isSelected,
  onSelectDate,
}: {
  day: CalendarDay
  hasRecord: boolean
  hasWorkout: boolean
  isSelected: boolean
  onSelectDate: (date: string) => void
}) {
  return (
    <button
      className={[
        'month-day',
        hasRecord ? 'checked-day' : '',
        hasWorkout ? 'workout-day' : '',
        day.isToday ? 'today-day' : '',
        isSelected ? 'selected-day' : '',
        day.isCurrentMonth ? '' : 'is-muted',
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
      aria-label={day.isToday ? `${day.isoDate}，今日` : day.isoDate}
      onClick={() => onSelectDate(day.isoDate)}
    >
      <span>{day.date.getDate()}</span>
      {day.isToday && <small>今日</small>}
    </button>
  )
}

function TrendsPage({
  canGoNext,
  canGoPrevious,
  mode,
  stats,
  onModeChange,
  onPeriodShift,
}: {
  canGoNext: boolean
  canGoPrevious: boolean
  mode: HistoryMode
  stats: TrendStats
  onModeChange: (mode: HistoryMode) => void
  onPeriodShift: (offset: number) => void
}) {
  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="eyebrow">Trends</p>
        <h1>趋势</h1>
        <p>查看近期状态、长期变化和记录稳定性。</p>
      </header>

      <section className="app-card trend-control-card">
        <HistoryModeSwitcher mode={mode} onModeChange={onModeChange} />
        <HistoryPeriodNavigator
          canGoNext={canGoNext}
          canGoPrevious={canGoPrevious}
          period={stats.period}
          onPeriodShift={onPeriodShift}
        />
      </section>

      <TrendOverviewCard stats={stats} />
      <TrendMetricGrid metrics={stats.metrics} />
      <SleepTrendChart days={stats.trendDays} mode={mode} />
      <WorkoutFrequencyChart days={stats.trendDays} />
      <StabilityCard stats={stats} />
      <TrendInsights insights={stats.insights} />
    </div>
  )
}

function TrendOverviewCard({ stats }: { stats: TrendStats }) {
  return (
    <section className="app-card trend-overview-card">
      <div>
        <p className="eyebrow">总览</p>
        <h2>{stats.period.label}</h2>
        {stats.period.rangeLabel && <span>{stats.period.rangeLabel}</span>}
      </div>

      <div className="trend-overview-grid">
        <div>
          <strong>{stats.recordDays}</strong>
          <span>记录天数</span>
        </div>
        <div>
          <strong>{stats.workoutDays}</strong>
          <span>运动天数</span>
        </div>
        <div>
          <strong>{formatAverage(stats.averageSleep, ' 小时')}</strong>
          <span>平均睡眠</span>
        </div>
        <div>
          <strong>{stats.currentStreak}</strong>
          <span>连续记录</span>
        </div>
      </div>
    </section>
  )
}

function TrendMetricGrid({ metrics }: { metrics: TrendMetric[] }) {
  return (
    <section className="trend-metric-grid">
      {metrics.map((metric) => (
        <article className="trend-metric-card" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small className={`trend-change ${metric.tone}`}>{metric.change}</small>
        </article>
      ))}
    </section>
  )
}

function SleepTrendChart({
  days,
  mode,
}: {
  days: TrendDayPoint[]
  mode: HistoryMode
}) {
  const chartPoints = getSleepChartPoints(mode, days)
  const sleepValues = chartPoints
    .map((point) => point.sleepHours)
    .filter((value): value is number => value !== null)
  const maxSleep = Math.max(...sleepValues, 8)
  const minWidth =
    mode === 'year' ? 320 : mode === 'month' ? Math.max(days.length * 12, 360) : 280

  return (
    <section className="app-card trend-chart-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">睡眠趋势</p>
          <h2>睡眠时长变化</h2>
        </div>
      </div>

      <div className="trend-chart-scroll">
        <div className={`sleep-bars ${mode}-chart`} style={{ minWidth: `${minWidth}px` }}>
          {chartPoints.map((point) => {
            const heightPercent =
              point.sleepHours === null ? 0 : Math.max((point.sleepHours / maxSleep) * 100, 12)

            return (
              <div className="sleep-bar-item" key={point.key}>
                {point.sleepHours === null ? (
                  <span className="sleep-bar-placeholder" title={`${point.label} 未记录`} />
                ) : (
                  <span
                    className="sleep-bar"
                    title={`${point.label} ${Number(point.sleepHours.toFixed(1))} 小时`}
                    style={{ height: `${heightPercent}%` }}
                  />
                )}
                <small>{point.showLabel ? point.label : ''}</small>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function WorkoutFrequencyChart({ days }: { days: TrendDayPoint[] }) {
  return (
    <section className="app-card trend-chart-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">运动频率</p>
          <h2>运动日分布</h2>
        </div>
      </div>

      <div className="workout-dots">
        {days.map((day) => (
          <span
            className={day.hasWorkout ? 'workout-dot is-active' : 'workout-dot'}
            key={day.date}
            title={`${day.date} ${day.hasWorkout ? '有运动' : '无运动'}`}
          />
        ))}
      </div>
    </section>
  )
}

function StabilityCard({ stats }: { stats: TrendStats }) {
  return (
    <section className="app-card stability-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">稳定性</p>
          <h2>记录节奏</h2>
        </div>
      </div>

      <div className="stability-grid">
        <DetailItem label="记录率" value={`${Math.round(stats.recordRate * 100)}%`} />
        <DetailItem label="运动记录率" value={`${Math.round(stats.workoutRate * 100)}%`} />
        <DetailItem label="漏记天数" value={`${stats.missedDays} 天`} />
        <DetailItem label="最长连续" value={`${stats.longestStreak} 天`} />
      </div>

      <p>{getTrendSummaryText(stats)}</p>
    </section>
  )
}

function TrendInsights({ insights }: { insights: string[] }) {
  return (
    <section className="app-card trend-insight-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">洞察</p>
          <h2>趋势提示</h2>
        </div>
      </div>

      <div className="trend-insight-list">
        {insights.map((insight) => (
          <p key={insight}>{insight}</p>
        ))}
      </div>
    </section>
  )
}

function SelectedDateDetailCard({
  record,
  selectedDate,
  onEditRecord,
  onFillDate,
}: {
  record?: CheckinRecord
  selectedDate: string
  onEditRecord: (record: CheckinRecord) => void
  onFillDate: () => void
}) {
  return (
    <section className="app-card selected-date-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">选中日期</p>
          <h2>{selectedDate}</h2>
        </div>
      </div>

      {record ? (
        <>
          <div className="detail-grid">
            <DetailItem label="日期" value={record.date} />
            <DetailItem label="睡眠时间" value={formatValue(record.sleepHours, ' 小时')} />
            <DetailItem label="有氧运动" value={yesNo(record.cardio)} />
            <DetailItem label="力量训练" value={yesNo(record.strength)} />
            <DetailItem label="饮食记录" value={formatValue(record.meals, ' 顿')} />
          </div>

          <div className="note-list">
            <DetailNote label="睡眠附录" value={record.sleepNote} />
            <DetailNote label="有氧附录" value={record.cardioNote} />
            <DetailNote label="力量附录" value={record.strengthNote} />
            <DetailNote label="饮食附录" value={record.mealsNote} />
            <DetailNote label="额外补充" value={record.extraNote} />
          </div>

          <button
            className="primary-button detail-primary-action"
            type="button"
            onClick={() => onEditRecord(record)}
          >
            编辑记录
          </button>
        </>
      ) : (
        <div className="selected-date-empty">
          <p>当天暂无记录</p>
          <button className="primary-button" type="button" onClick={onFillDate}>
            去填写
          </button>
        </div>
      )}
    </section>
  )
}

function CalendarDialog({
  calendarDays,
  calendarDraftDate,
  recordsByDate,
  visibleMonth,
  onCancel,
  onConfirm,
  onMonthChange,
  onPickDate,
}: {
  calendarDays: CalendarDay[]
  calendarDraftDate: string
  recordsByDate: Map<string, CheckinRecord>
  visibleMonth: Date
  onCancel: () => void
  onConfirm: () => void
  onMonthChange: (offset: number) => void
  onPickDate: (date: string) => void
}) {
  return (
    <div className="calendar-overlay" role="presentation" onClick={onCancel}>
      <section
        aria-modal="true"
        className="calendar-dialog"
        role="dialog"
        aria-label="选择日期"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="calendar-header">
          <button
            className="calendar-nav-button"
            type="button"
            aria-label="上个月"
            onClick={() => onMonthChange(-1)}
          >
            ‹
          </button>
          <h3>{getMonthTitle(visibleMonth)}</h3>
          <button
            className="calendar-nav-button"
            type="button"
            aria-label="下个月"
            onClick={() => onMonthChange(1)}
          >
            ›
          </button>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {['一', '二', '三', '四', '五', '六', '日'].map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => {
            const dayRecord = recordsByDate.get(day.isoDate)
            const hasWorkout = Boolean(dayRecord?.cardio || dayRecord?.strength)

            return (
              <button
                className={[
                  'calendar-day',
                  dayRecord ? 'checked-day' : '',
                  hasWorkout ? 'workout-day' : '',
                  day.isCurrentMonth ? '' : 'is-muted',
                  day.isToday ? 'today-day' : '',
                  day.isoDate === calendarDraftDate ? 'selected-day' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                type="button"
                key={day.isoDate}
                aria-label={day.isToday ? `${day.isoDate}，今日` : day.isoDate}
                onClick={() => onPickDate(day.isoDate)}
              >
                <span>{day.date.getDate()}</span>
                {day.isToday && <small>今日</small>}
              </button>
            )
          })}
        </div>

        <CalendarLegend />

        <div className="calendar-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            取消
          </button>
          <button className="primary-button" type="button" onClick={onConfirm}>
            确认
          </button>
        </div>
      </section>
    </div>
  )
}

function CalendarLegend() {
  return (
    <div className="calendar-legend" aria-label="日历颜色说明">
      <span>
        <i className="legend-dot checked"></i>
        已打卡
      </span>
      <span>
        <i className="legend-dot workout"></i>
        有运动
      </span>
    </div>
  )
}

function BottomNav({
  activeView,
  onNavigate,
}: {
  activeView: ViewName
  onNavigate: (view: ViewName) => void
}) {
  return (
    <nav className="bottom-nav" aria-label="底部导航">
      <button
        className={activeView === 'today' ? 'nav-item is-active' : 'nav-item'}
        type="button"
        onClick={() => onNavigate('today')}
      >
        <span>⌂</span>
        今日
      </button>
      <button
        className={activeView === 'records' ? 'nav-item is-active' : 'nav-item'}
        type="button"
        onClick={() => onNavigate('records')}
      >
        <span>◷</span>
        记录
      </button>
      <button
        className={activeView === 'trends' ? 'nav-item is-active' : 'nav-item'}
        type="button"
        onClick={() => onNavigate('trends')}
      >
        <span>⌁</span>
        趋势
      </button>
    </nav>
  )
}

export default App
