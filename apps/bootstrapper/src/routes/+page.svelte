<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
    <!-- Background pattern -->
    <div class="absolute inset-0 opacity-5">
        <div
            class="h-full w-full"
            style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.1) 10px, rgba(255,255,255,.1) 20px);"
        ></div>
    </div>

    <div class="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <!-- Header -->
        <header class="text-center mb-12">
            <div
                class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mb-6 shadow-2xl"
            >
                <span class="text-3xl">🚀</span>
            </div>
            <h1
                class="text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-purple-300 bg-clip-text text-transparent mb-4"
            >
                Bootstrapper Account Service
            </h1>
            <p class="text-xl text-purple-200 max-w-2xl mx-auto">
                Advanced Nostr Job Management with Intelligent Bid Resolution
            </p>
        </header>

        <!-- Stats Row -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div
                class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-center shadow-lg"
            >
                <div class="text-2xl font-bold text-white">0</div>
                <div class="text-blue-100 text-sm">Active Jobs</div>
            </div>
            <div
                class="bg-gradient-to-r from-amber-600 to-orange-600 rounded-xl p-4 text-center shadow-lg"
            >
                <div class="text-2xl font-bold text-white">0</div>
                <div class="text-amber-100 text-sm">Pending Bids</div>
            </div>
            <div
                class="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-4 text-center shadow-lg"
            >
                <div class="text-2xl font-bold text-white">0</div>
                <div class="text-green-100 text-sm">Completed</div>
            </div>
            <div
                class="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-center shadow-lg"
            >
                <div class="text-2xl font-bold text-white">0</div>
                <div class="text-purple-100 text-sm">Providers</div>
            </div>
        </div>

        <!-- Main Grid -->
        <div class="grid lg:grid-cols-3 gap-6">
            <!-- Connection Status -->
            <div class="lg:col-span-1">
                <div
                    class="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6"
                >
                    <div class="flex items-center mb-6">
                        <div
                            class="w-10 h-10 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl flex items-center justify-center mr-3"
                        >
                            <span class="text-xl">🔗</span>
                        </div>
                        <h2 class="text-xl font-bold text-white">Connection Status</h2>
                    </div>

                    <div class="space-y-4">
                        <div
                            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                            <div class="flex items-center">
                                <div
                                    class="w-3 h-3 bg-red-500 rounded-full mr-3 animate-pulse"
                                ></div>
                                <span class="text-gray-300">Local Relay</span>
                            </div>
                            <span class="text-sm text-red-400 font-medium">Disconnected</span>
                        </div>

                        <div
                            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                            <div class="flex items-center">
                                <div
                                    class="w-3 h-3 bg-red-500 rounded-full mr-3 animate-pulse"
                                ></div>
                                <span class="text-gray-300">Database</span>
                            </div>
                            <span class="text-sm text-red-400 font-medium">Not initialized</span>
                        </div>

                        <div
                            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                            <div class="flex items-center">
                                <div
                                    class="w-3 h-3 bg-yellow-500 rounded-full mr-3 animate-pulse"
                                ></div>
                                <span class="text-gray-300">WebSocket</span>
                            </div>
                            <span class="text-sm text-yellow-400 font-medium">Waiting</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="lg:col-span-1">
                <div
                    class="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6"
                >
                    <div class="flex items-center mb-6">
                        <div
                            class="w-10 h-10 bg-gradient-to-r from-blue-400 to-blue-500 rounded-xl flex items-center justify-center mr-3"
                        >
                            <span class="text-xl">⚡</span>
                        </div>
                        <h2 class="text-xl font-bold text-white">Quick Actions</h2>
                    </div>

                    <div class="space-y-3">
                        <button
                            class="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            <div class="flex items-center justify-center">
                                <span class="mr-2">✨</span>
                                Create New Job
                            </div>
                        </button>

                        <button
                            class="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            <div class="flex items-center justify-center">
                                <span class="mr-2">📋</span>
                                View All Jobs
                            </div>
                        </button>

                        <button
                            class="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            <div class="flex items-center justify-center">
                                <span class="mr-2">👥</span>
                                Manage Providers
                            </div>
                        </button>

                        <button
                            class="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            <div class="flex items-center justify-center">
                                <span class="mr-2">⚙️</span>
                                Settings
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Configuration -->
            <div class="lg:col-span-1">
                <div
                    class="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6"
                >
                    <div class="flex items-center mb-6">
                        <div
                            class="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl flex items-center justify-center mr-3"
                        >
                            <span class="text-xl">⚙️</span>
                        </div>
                        <h2 class="text-xl font-bold text-white">Configuration</h2>
                    </div>

                    <div class="space-y-4">
                        <div
                            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                            <span class="text-gray-300 font-medium">Bid Timeout</span>
                            <span class="text-purple-300 font-bold">5 minutes</span>
                        </div>

                        <div
                            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                            <span class="text-gray-300 font-medium">Auto Resolution</span>
                            <span
                                class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                            >
                                <div class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></div>
                                Enabled
                            </span>
                        </div>

                        <div
                            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                            <span class="text-gray-300 font-medium">Min Reputation</span>
                            <span class="text-purple-300 font-bold">0</span>
                        </div>

                        <div
                            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                            <span class="text-gray-300 font-medium">Active Relays</span>
                            <span class="text-purple-300 font-bold">1</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="text-center mt-12">
            <div
                class="inline-flex items-center px-6 py-3 bg-white/5 backdrop-blur-sm rounded-full border border-white/10"
            >
                <div class="w-2 h-2 bg-green-500 rounded-full mr-3 animate-pulse"></div>
                <span class="text-purple-200 text-sm font-medium">
                    Bootstrapper Account Service v0.1.0 • Running on localhost:8001
                </span>
            </div>

            <p class="text-purple-300/60 text-xs mt-4">
                Built with SvelteKit & Tailwind CSS • Powered by Nostr Protocol
            </p>
        </footer>
    </div>
</div>
