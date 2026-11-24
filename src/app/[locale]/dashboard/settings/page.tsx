import { redirect } from "next/navigation";

export default function LegacySecuritySettingsRedirect() {
    redirect("/dashboard/profile");
}
