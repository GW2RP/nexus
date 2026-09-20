import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

/** « J'ai un code d'invitation ». Un formulaire `GET` tout simple : la page
 *  `/invitation` renvoie sur `/invitation/<code>`, donc rien ici n'a besoin de
 *  JavaScript — un code reçu en jeu s'ouvre au premier essai. */
export function InvitationCodeForm({
  label = "J'ai un code d'invitation",
  labelHidden = false,
  className,
}: {
  label?: string;
  labelHidden?: boolean;
  className?: string;
}) {
  return (
    <form action="/invitation" method="get" className={className}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="code-invitation" hidden={labelHidden}>
            {label}
          </Label>
          <Input
            id="code-invitation"
            name="code"
            placeholder="K7M2-QW9D"
            autoComplete="off"
            spellCheck={false}
            className="w-[200px] font-display tracking-[1px]"
          />
        </div>
        <Button type="submit" variant="outline">
          OUVRIR
        </Button>
      </div>
    </form>
  );
}
