/** Le retour d'une action de formulaire, lu par `useActionState`.
 *  Ce module ne touche à rien du serveur : les composants client l'importent
 *  sans tirer la base de données derrière eux. */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Où aller après un succès, quand l'action crée un contenu. */
  redirectTo?: string;
};

export const idleState: ActionState = { status: "idle" };

export function errorState(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: "error", message, fieldErrors };
}

export function successState(message: string, redirectTo?: string): ActionState {
  return { status: "success", message, redirectTo };
}
