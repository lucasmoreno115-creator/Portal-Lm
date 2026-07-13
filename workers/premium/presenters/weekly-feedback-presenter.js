import { createPassThroughPresenter } from './create-pass-through-presenter.js';

export function createWeeklyFeedbackPresenter() {
  return createPassThroughPresenter('weekly-feedback');
}
