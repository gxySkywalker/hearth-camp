import * as echarts from 'echarts/core'
import type { EChartsCoreOption } from 'echarts/core'
import { BarChart, HeatmapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])

const BASE = {
  textStyle: { fontFamily: "'Fusion Pixel','Courier New',monospace" },
  animationDuration: 150,
  animationDurationUpdate: 120,
}

const STAR = '#8FBCCC'
const STAR_HI = '#BEDCE2'
const STAR_L1 = '#496D7A'
const STAR_L2 = '#6F98A6'
const STAR_L3 = '#9FC5CE'
const STAR_L4 = '#E3EEE8'
const BRASS = '#C39755'
const CHART_BG = '#283342'
const CHART_BG2 = '#303B49'
const AXIS_TEXT = '#D8CCB5'
const AXIS_MUTED = '#A99D88'
const AXIS_LINE = 'rgba(211,193,158,.15)'

const HOUR_LABELS = ['0','','','3','','','6','','','9','','','12','','','15','','','18','','','21','','','']
const DAY_NAMES = ['周一','周二','周三','周四','周五','周六','周日']

export const ECHARTS = { init: echarts.init, dispose: echarts.dispose, getInstanceByDom: echarts.getInstanceByDom }

function fmtShort(s: number): string {
  if (s < 60) return `${s}s`
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`
  return `${m}m`
}
function fmtLong(s: number): string {
  if (s < 60) return `${s}秒`
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}小时${m}分钟星轨` : `${h}小时`
  return `${m}分钟星轨`
}

export function hourlyOption(hourly: number[]): EChartsCoreOption {
  const bars = hourly.map((v, i) => v > 0 ? { value: [i, v], itemStyle: { color: STAR, borderRadius: 0 } } : null).filter(Boolean)
  return {
    ...BASE,
    grid: { top: 8, right: 8, bottom: 20, left: 8 },
    xAxis: { type: 'category', data: HOUR_LABELS, axisTick: { show: false }, axisLine: { lineStyle: { color: AXIS_LINE } }, axisLabel: { color: AXIS_MUTED, fontSize: 9 }, splitLine: { show: false } },
    yAxis: { type: 'value', min: 0, max: 3600, show: false },
    series: [{ type: 'bar', data: bars, barWidth: 9, barGap: '5%', emphasis: { itemStyle: { color: STAR_L4 } }, itemStyle: { borderRadius: 0, color: STAR } }],
    tooltip: { trigger: 'item', backgroundColor: CHART_BG, borderColor: BRASS, textStyle: { color: AXIS_TEXT, fontSize: 12 }, formatter: (p: any) => p?.data ? `${p.data.value[0]}时<br/>留下${fmtLong(p.data.value[1])}` : '' },
  }
}

export function weeklyBarsOption(daily: number[], todayIdx: number): EChartsCoreOption {
  const max = Math.max(1, ...daily)
  const bars = daily.map((v, i) => v > 0 ? { value: v, itemStyle: { color: STAR, borderRadius: 0 } } : null)
  return {
    ...BASE,
    grid: { top: 28, right: 12, bottom: 24, left: 12 },
    xAxis: { type: 'category', data: DAY_NAMES, axisTick: { show: false }, axisLine: { lineStyle: { color: AXIS_LINE } }, axisLabel: { color: AXIS_MUTED, fontSize: 10, rich: { today: { color: BRASS, fontWeight: 'bold' } }, formatter: (_: any, i: number) => i === todayIdx ? `{today|${DAY_NAMES[i]}}` : DAY_NAMES[i] }, splitLine: { show: false } },
    yAxis: { type: 'value', min: 0, max, show: false },
    series: [{ type: 'bar', data: bars, barWidth: 32, barGap: '15%', emphasis: { itemStyle: { color: STAR_L4 } }, label: { show: true, position: 'top', color: AXIS_MUTED, fontSize: 10, formatter: (p: any) => p.data?.value ? fmtShort(p.data.value) : '' }, itemStyle: { borderRadius: 0, color: STAR } }],
    tooltip: { trigger: 'item', backgroundColor: CHART_BG, borderColor: BRASS, textStyle: { color: AXIS_TEXT, fontSize: 12 }, formatter: (p: any) => p.data?.value ? `${DAY_NAMES[p.dataIndex]} · 出征${fmtLong(p.data.value)}` : '' },
  }
}

export function monthlyBarsOption(daily: number[], year: number, month: number, todayDate = -1): EChartsCoreOption {
  const days = daily.map((_, index) => String(index + 1))
  const maxValue = Math.max(1, ...daily)
  const axisMax = Math.max(3600, Math.ceil(maxValue / 3600) * 3600)
  const bars = daily.map((value, index) => value > 0 ? {
    value,
    itemStyle: { color: index + 1 === todayDate ? STAR_HI : STAR, borderRadius: 0 },
  } : 0)
  return {
    ...BASE,
    grid: { top: 20, right: 18, bottom: 28, left: 62 },
    xAxis: {
      type: 'category', data: days, axisTick: { show: false },
      axisLine: { lineStyle: { color: AXIS_LINE } }, splitLine: { show: false },
      axisLabel: {
        color: AXIS_MUTED, fontSize: 9,
        formatter: (value: string, index: number) => (index === 0 || index === daily.length - 1 || (index + 1) % 5 === 0) ? value : '',
      },
    },
    yAxis: {
      type: 'value', min: 0, max: axisMax, splitNumber: Math.min(5, Math.max(2, axisMax / 3600)),
      axisTick: { show: false }, axisLine: { show: false },
      splitLine: { lineStyle: { color: AXIS_LINE } },
      axisLabel: { color: AXIS_MUTED, fontSize: 9, formatter: (value: number) => value === 0 ? '0' : value % 3600 === 0 ? `${value / 3600}小时` : `${Math.round(value / 60)}分` },
    },
    series: [{
      type: 'bar', data: bars, barMaxWidth: 18, barMinHeight: 2,
      emphasis: { itemStyle: { color: STAR_L4 } },
      itemStyle: { color: STAR, borderRadius: 0 },
    }],
    tooltip: {
      trigger: 'item', backgroundColor: CHART_BG, borderColor: BRASS,
      textStyle: { color: AXIS_TEXT, fontSize: 12 },
      formatter: (p: any) => Number(p?.value) > 0 ? `${year}年${month}月${p.dataIndex + 1}日<br/>留下${fmtLong(Number(p.value))}` : '',
    },
  }
}

export function yearlyBarsOption(monthly: number[], year: number, currentMonth = -1): EChartsCoreOption {
  const labels = monthly.map((_, index) => `${index + 1}月`)
  const maxValue = Math.max(1, ...monthly)
  const axisMax = Math.max(3600, Math.ceil(maxValue / 3600) * 3600)
  return {
    ...BASE,
    grid: { top: 24, right: 22, bottom: 32, left: 68 },
    xAxis: {
      type: 'category', data: labels, axisTick: { show: false },
      axisLine: { lineStyle: { color: AXIS_LINE } }, splitLine: { show: false },
      axisLabel: { color: AXIS_MUTED, fontSize: 10 },
    },
    yAxis: {
      type: 'value', min: 0, max: axisMax, splitNumber: 5,
      axisTick: { show: false }, axisLine: { show: false },
      splitLine: { lineStyle: { color: AXIS_LINE } },
      axisLabel: { color: AXIS_MUTED, fontSize: 9, formatter: (value: number) => value === 0 ? '0' : `${Math.round(value / 3600)}小时` },
    },
    series: [{
      type: 'bar', barMaxWidth: 42, barMinHeight: 2,
      data: monthly.map((value, index) => ({ value, itemStyle: { color: index + 1 === currentMonth ? STAR_HI : STAR } })),
      emphasis: { itemStyle: { color: STAR_L4 } }, itemStyle: { borderRadius: 0 },
    }],
    tooltip: {
      trigger: 'item', backgroundColor: CHART_BG, borderColor: BRASS,
      textStyle: { color: AXIS_TEXT, fontSize: 12 },
      formatter: (p: any) => Number(p?.value) > 0 ? `${year}年${p.dataIndex + 1}月<br/>汇成${fmtLong(Number(p.value))}` : `${year}年${p.dataIndex + 1}月<br/>尚未留下星轨`,
    },
  }
}

export function heatmapOption(grid: number[][], todayRow: number): EChartsCoreOption {
  const data: [number, number, number][] = []
  for (let day = 0; day < 7; day++) for (let hour = 0; hour < 24; hour++) {
    const v = grid[day]?.[hour] || 0
    if (v > 0) data.push([hour, day, v])
  }
  return {
    ...BASE,
    grid: { top: 4, right: 8, bottom: 20, left: 40 },
    xAxis: { type: 'category', data: HOUR_LABELS, position: 'top', axisTick: { show: false }, axisLine: { lineStyle: { color: AXIS_LINE } }, axisLabel: { color: AXIS_MUTED, fontSize: 9 }, splitLine: { show: false } },
    yAxis: { type: 'category', data: DAY_NAMES, inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: AXIS_LINE } }, axisLabel: { color: AXIS_MUTED, fontSize: 10, rich: { today: { color: BRASS, fontWeight: 'bold' } }, formatter: (_: any, i: number) => i === todayRow ? `{today|${DAY_NAMES[i]}}` : DAY_NAMES[i] }, splitLine: { show: false } },
    visualMap: { min: 0, max: 3600, show: false, inRange: { color: ['transparent', STAR_L1, STAR_L2, STAR_L3, STAR_L4] } },
    series: [{ type: 'heatmap', data, itemStyle: { borderWidth: 2, borderColor: CHART_BG, borderRadius: 0 }, emphasis: { itemStyle: { borderColor: BRASS, borderWidth: 2 } }, label: { show: false } }],
    tooltip: { backgroundColor: CHART_BG, borderColor: BRASS, textStyle: { color: AXIS_TEXT, fontSize: 12 }, formatter: (p: any) => { const d = p.data; return d ? `${DAY_NAMES[d[1]]} ${d[0]}时<br/>留下${fmtLong(d[2])}` : '' } },
  }
}
