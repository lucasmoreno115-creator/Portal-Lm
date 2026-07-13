import { createPassThroughPresenter } from './create-pass-through-presenter.js';

export function createWorkspacePresenter() {
  return createPassThroughPresenter('workspace');
}
