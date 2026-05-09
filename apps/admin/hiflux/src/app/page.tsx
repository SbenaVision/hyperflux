import { redirect } from "next/navigation";
import "../lib/init-store";
import { readConfigString } from "../lib/server-resolver";

export default function HomePage() {
  redirect(readConfigString("hiflux.config.default_route", "/rules"));
}
