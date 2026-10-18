"use client";

import dynamic from "next/dynamic";

const WebVitalsReporter = dynamic(
    () => import("@/components/common/web-vitals-reporter"),
    { ssr: false }
);

export default function ClientVitalsReporter() {
    return <WebVitalsReporter />;
}