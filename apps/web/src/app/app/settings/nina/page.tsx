import { permanentRedirect } from "next/navigation";

/** Der frühere Ort der Gesprächseinstellungen. Siehe `/app/nina`. */
export default function NinaEinstellungenWeiterleitung(): never {
  permanentRedirect("/app/settings/monday");
}
