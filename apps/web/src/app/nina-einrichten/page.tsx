import { permanentRedirect } from "next/navigation";

/** Der frühere Ort der Einrichtung. Siehe `/app/nina`. */
export default function NinaEinrichtenWeiterleitung(): never {
  permanentRedirect("/monday-einrichten");
}
