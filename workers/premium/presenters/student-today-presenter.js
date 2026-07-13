import { createPassThroughPresenter } from './create-pass-through-presenter.js';

export function createStudentTodayPresenter() {
  return createPassThroughPresenter('student-today');
}
