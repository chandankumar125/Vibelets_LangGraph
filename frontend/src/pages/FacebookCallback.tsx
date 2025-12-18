
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const FacebookCallback = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Check for hash params (implicit flow) or query params (code flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);

        const accessToken = hashParams.get('access_token');
        const error = hashParams.get('error') || queryParams.get('error');

        if (accessToken) {
            // Send token to opener
            if (window.opener) {
                window.opener.postMessage({ type: 'FACEBOOK_AUTH_SUCCESS', accessToken }, window.location.origin);
                window.close();
            } else {
                // Fallback if no opener (e.g. manual navigation)
                navigate('/dashboard');
            }
        } else if (error) {
            if (window.opener) {
                window.opener.postMessage({ type: 'FACEBOOK_AUTH_ERROR', error }, window.location.origin);
                window.close();
            }
        }
    }, [navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Connecting to Facebook...</h2>
                <p className="text-muted-foreground">Please wait while we verify your account.</p>
            </div>
        </div>
    );
};

export default FacebookCallback;
