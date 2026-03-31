import { navigateToPage } from './navigation-actions';
import { useNutritionStore } from '../../stores/nutrition-store';

export function openNutritionSettings() {
  navigateToPage('settings');
}

export function openNutritionLogin() {
  window.openNutritionLogin?.();
}

export function clearNutritionHistory() {
  useNutritionStore.getState().clearHistory();
}

export function retryLastNutritionMessage() {
  return useNutritionStore.getState().retryLastMessage();
}

export function selectNutritionAction(actionId: string) {
  const store = useNutritionStore.getState();
  void store.selectAction(actionId);
  return store.submitSelectedAction();
}

export function submitNutritionTextMessage(
  text: string,
  isCorrection = false
) {
  return useNutritionStore.getState().submitTextMessage(text, isCorrection);
}

export function handleNutritionPhoto(event: Event) {
  useNutritionStore.getState().handlePhoto(event);
}
