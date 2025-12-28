'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';

import Image from 'next/image';
import Logo from '../../../public/intervous_logo.png'

export default function LoginPage() {
    const { user, signIn } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.isAuthenticated) {
            router.push('/dashboard');
        }
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await signIn(email, password);
            router.push('/dashboard');
        } catch (error: unknown) {
            if (error instanceof Error) {
                setErrorMsg(error.message);
            } else {
                setErrorMsg(String(error));
            }
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="flex items-center justify-center">
                    <Image src={Logo} alt="logo" className="w-40 h-40" />
                </div>
                <form onSubmit={handleSubmit} className="text-black space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        className="cursor-pointer w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                    {errorMsg && <p className="text-red-600 text-sm text-center">{errorMsg}</p>}
                </form>
            </div>
        </div>
    );
}
