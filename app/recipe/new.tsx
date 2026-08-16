import { EmptyState, Screen } from '../../src/components/ui';

export default function NewRecipeScreen() {
  return (
    <Screen>
      <EmptyState title="New recipe" message="Coming next." />
    </Screen>
  );
}
