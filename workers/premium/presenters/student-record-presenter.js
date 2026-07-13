import { createPassThroughPresenter } from './create-pass-through-presenter.js';

export function createStudentRecordPresenter() {
  return createPassThroughPresenter('student-record');
}
