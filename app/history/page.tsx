import { HistoryList } from "./history-list";
import { SiteFooter, SiteHeader } from "../site-chrome";
export default function HistoryPage() { return <main className="inner-page"><SiteHeader active="history" /><HistoryList /><SiteFooter /></main>; }
