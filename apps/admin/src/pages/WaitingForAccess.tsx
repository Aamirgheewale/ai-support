import { Shield } from 'lucide-react';

export default function WaitingForAccess() {
    return (
        <div className="w-full min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 z-10 relative">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-8 text-center space-y-6 border border-gray-100 dark:border-gray-700">
                <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                    <Shield className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>

                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                        Account Active
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300">
                        Your account is approved, but you have not been assigned any specific pages yet.
                    </p>
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                        Please contact your administrator to request access to the Dashboard, Sessions, or other features.
                    </p>
                </div>
            </div>
        </div>
    );
}
