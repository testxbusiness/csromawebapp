export function canConfirmAthleteAttendance(
  role: string | null | undefined,
  activeArea: 'personal' | 'family',
  selectedProfileId: string | null,
  delegatedPermission: boolean | undefined,
): boolean {
  if (activeArea === 'family') return Boolean(selectedProfileId && delegatedPermission)
  return role === 'athlete'
}
