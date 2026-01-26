import { Loader2 } from 'lucide-react'
import React from 'react'

const Loading = () => {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-background">
            <div className="relative flex items-center justify-center">
                <div className="absolute h-24 w-24 rounded-full bg-green-500/10 blur-2xl animate-pulse" />
                <Loader2 className="relative h-12 w-12 animate-spin text-green-600" />
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

export default Loading