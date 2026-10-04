"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/settings-shell";
import type { RecordTarget } from "@/lib/record-routes";

/* Each screen is its own chunk, so opening a device does not download the
   seven other record screens with it. The loading frame is the same skeleton
   the screen draws for itself once it is mounted, so the swap from one to the
   other is invisible. */

const ActivityLogDetail = dynamic(
  () => import("@/components/record-screens/activity-log-detail"),
  { loading: () => <PageSkeleton title="Change details" sections={2} /> },
);
const ConnectedAppDetail = dynamic(
  () => import("@/components/record-screens/connected-app-detail"),
  { loading: () => <PageSkeleton title="Connected app" sections={2} /> },
);
const DeletedItemDetail = dynamic(
  () => import("@/components/record-screens/deleted-item-detail"),
  { loading: () => <PageSkeleton title="Recently deleted" sections={2} /> },
);
const DeviceDetail = dynamic(() => import("@/components/record-screens/device-detail"), {
  loading: () => <PageSkeleton title="Device" sections={3} />,
});
const DownloadDataDetail = dynamic(
  () => import("@/components/record-screens/download-data-detail"),
  { loading: () => <PageSkeleton title="Archive download" sections={2} /> },
);
const LoginEventDetail = dynamic(
  () => import("@/components/record-screens/login-event-detail"),
  { loading: () => <PageSkeleton title="Login activity" sections={3} /> },
);
const StatusSectionDetail = dynamic(
  () => import("@/components/record-screens/status-section-detail"),
  { loading: () => <PageSkeleton title="Account status" sections={3} /> },
);
const StatusItemDetail = dynamic(
  () => import("@/components/record-screens/status-item-detail"),
  { loading: () => <PageSkeleton title="Account status" sections={3} /> },
);

/** The one client component behind every record address. The path was already
    read on the server, which is why this takes the answer rather than asking
    for the path again. */
export default function RecordRoute({ target }: { target: RecordTarget }) {
  switch (target.screen) {
    case "activity-log":
      return <ActivityLogDetail id={target.id} />;
    case "connected-apps":
      return <ConnectedAppDetail id={target.id} />;
    case "devices":
      return <DeviceDetail id={target.id} />;
    case "download-data":
      return <DownloadDataDetail id={target.id} />;
    case "login-activity":
      return <LoginEventDetail id={target.id} />;
    case "recently-deleted":
      return <DeletedItemDetail id={target.id} />;
    case "status-section":
      return <StatusSectionDetail section={target.section} />;
    case "status-item":
      return <StatusItemDetail section={target.section} item={target.item} />;
  }
}