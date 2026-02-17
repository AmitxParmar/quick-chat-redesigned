"use client";

import dynamic from "next/dynamic";

const GlobalSocketListener = dynamic(
    () => import("@/components/common/global-socket-listener"),
    { ssr: false }
);

export default function ClientSocketListener() {
    return <GlobalSocketListener />;
}
