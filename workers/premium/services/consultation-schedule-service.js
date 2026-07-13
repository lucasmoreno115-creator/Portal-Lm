export function createConsultationScheduleService({ now = () => new Date() } = {}) {
  return Object.freeze({
    now,
    isPast(date) {
      return new Date(date).getTime() < now().getTime();
    },
  });
}
