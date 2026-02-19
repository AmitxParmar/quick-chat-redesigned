const Loader = () => {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-background">
            <div className="relative flex items-center justify-center">
                <div className="absolute h-24 w-24 rounded-full bg-green-500/10 blur-2xl animate-pulse" />
                {/* Inline SVG spinner to avoid importing lucide-react on the critical path */}
                <svg
                    className="relative h-12 w-12 animate-spin text-green-600"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                </svg>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-lg font-medium text-foreground">Starting Server</p>
                <p className="max-w-[250px] text-sm text-muted-foreground">
                    The server is booting up. This process may take 1-2 minutes.
                </p>
            </div>
        </div>
    )
}

export default Loader