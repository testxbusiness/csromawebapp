import type { AttendanceMode, AttendanceStatus } from '@/types/attendance'

export type AttendanceReportProfile = { id: string; first_name: string; last_name: string; email?: string | null }
export type AttendanceReportEntry = { profile_id: string; status: AttendanceStatus; responded_at: string | null; profiles?: AttendanceReportProfile | null }

export function buildAttendanceReport(
  mode: AttendanceMode,
  profiles: AttendanceReportProfile[],
  attendances: AttendanceReportEntry[],
) {
  const byProfileId = new Map(attendances.map((attendance) => [attendance.profile_id, attendance]))
  const going: AttendanceReportEntry[] = []
  const maybe: AttendanceReportEntry[] = []
  const declined: AttendanceReportEntry[] = []
  const noResponse: AttendanceReportProfile[] = []
  const available: AttendanceReportProfile[] = []
  const absent: AttendanceReportEntry[] = []
  for (const profile of profiles) {
    const attendance = byProfileId.get(profile.id)
    if (mode === 'absence_only') {
      if (attendance?.status === 'declined') absent.push(attendance)
      else available.push(profile)
      continue
    }
    if (!attendance) noResponse.push(profile)
    else if (attendance.status === 'going') going.push(attendance)
    else if (attendance.status === 'maybe') maybe.push(attendance)
    else declined.push(attendance)
  }
  return {
    attendance_mode: mode,
    going, maybe, declined, no_response: noResponse, available, absent,
    counts: {
      going: going.length, maybe: maybe.length, declined: declined.length, no_response: noResponse.length,
      available: available.length, absent: absent.length, roster: profiles.length,
    },
  }
}
