import { AccountSettings } from "./account-settings";
import { SiteFooter, SiteHeader } from "../site-chrome";
export default function AccountPage() { return <main className="inner-page"><SiteHeader active="account" /><AccountSettings /><SiteFooter /></main>; }
