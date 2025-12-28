import { useState } from "react";
import { ApiKeys } from "../../lib/types";
import { setApiKeys } from "../../lib/keyService";
import { useAuth } from "../../contexts/AuthContext";

interface KeysPanelProps {
    keys: ApiKeys | null;
    onClose: () => void;
}

type FormField = keyof Pick<ApiKeys, "open_ai" | "deep_seek" | "mistral">;

export default function KeysPanel({ keys, onClose }: KeysPanelProps) {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { user } = useAuth();

    const [formData, setFormData] = useState<ApiKeys>({
        user_id: user.id,
        open_ai: keys?.open_ai ?? '',
        deep_seek: keys?.deep_seek ?? '',
        mistral: keys?.mistral ?? '',
    });

    const handleSubmit = async () => {
        setError('');
        setLoading(true);

        try {
            await setApiKeys(user.id, formData as ApiKeys);
            onClose();
        } catch (err) {
            setError("There was a problem while submitting your keys. Try again");
            console.log(err)
        } finally {
            setLoading(false);
        }
    };


    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }


    return (
        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-30 bg-white p-6 rounded-xl shadow-2xl w-[30rem] border border-gray-200">
            <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">Your API Keys</h2>
            <p className="text-gray-800 text-center mb-3">Here you can manage your API keys</p>

            {(["open_ai", "deep_seek", "mistral"] as FormField[]).map(field => (
                <div key={field} className="mb-4">
                    <label className="block font-bold text-gray-700 capitalize">
                        {field.replace(/_/g, ' ')}
                    </label>
                    <input
                        type="text"
                        name={field}
                        value={formData[field] ?? ''}
                        onChange={handleChange}
                        placeholder="No key inserted"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border text-gray-500"
                    />
                </div>
            ))}

            {error && <p className="text-red-500 text-m mb-3 text-center">{error}</p>}

            <div className="flex justify-around gap-3">
                <button
                    onClick={onClose}
                    className="bg-gradient-to-r from-neutral-300 to-stone-400 font-bold py-2 px-4 rounded-full cursor-pointer text-gray-700 shadow-2xl"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-200 to-cyan-200 text-gray-700 font-bold py-2 px-4 rounded-full cursor-pointer shadow-2xl"
                >
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
}