'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { User } from 'lucide-react';
import Logo from '../../public/intervous_logo.png';
import { useState } from 'react';
import KeysPanel from './KeysPanel';
import { ApiKeys } from '../../lib/types';

interface TopBarProps {
    keys: ApiKeys | null;
}

export default function TopBar({ keys }: TopBarProps) {
    const router = useRouter();
    const { user, signOut } = useAuth();

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showKeysPanel, setShowKeysPanel] = useState(false);

    const handleLogout = async () => {
        await signOut();
        router.push('/intervous/login');
    };

    return (
        <>
            <header className="w-full bg-gradient-to-r from-blue-200 to-cyan-200 py-6 px-6 shadow-xl  relative flex items-center justify-between rounded">
                {/* Logo */}
                <div className="flex items-center space-x-3">
                    <div className="relative mr-3">
                        <Image src={Logo} alt="Logo" width={70} height={70} priority={true} />
                    </div>
                </div>

                {/* Center Title */}
                <h1 className="absolute left-1/2 transform -translate-x-1/2 text-5xl font-bold text-gray-700 drop-shadow-lg">
                    InterVous
                </h1>

                {/* User Icon & Dropdown */}
                <div className="relative mr-3">
                    <button
                        onClick={() => setDropdownOpen(prev => !prev)}
                        className="text-gray-700 hover:text-gray-400 focus:outline-none cursor-pointer"
                    >
                        <User size={35} />
                    </button>
                    {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-60 bg-white rounded-md shadow-lg z-50 p-4 text-sm flex flex-col items-center justify-center">
                            <p className="text-gray-700 mb-2 font-bold">{user?.email ?? 'User'}</p>
                            <button
                                onClick={() => { setShowKeysPanel(true); setDropdownOpen(prev => !prev) }}
                                className="w-[70%] cursor-pointer bg-gradient-to-r from-neutral-300 to-stone-400 text-gray-700 px-3 py-1 rounded-full mb-2 font-bold "
                            >
                                Manage API keys
                            </button>

                            <button
                                onClick={handleLogout}
                                className="w-[70%] cursor-pointer bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1 rounded-full "
                            >
                                Logout
                            </button>

                        </div>

                    )}
                </div>
            </header>
            {showKeysPanel && (
                <>
                    {/* Background blur layer */}
                    <div className="fixed inset-0 backdrop-blur-sm z-20" />
                    {/* Panel */}
                    <KeysPanel
                        onClose={() => {
                            setShowKeysPanel(false);
                        }}
                        keys={keys}
                    />
                </>
            )}
        </>
    );
}
