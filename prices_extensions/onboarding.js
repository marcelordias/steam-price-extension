document.getElementById('submit-token').addEventListener('click', async () => {
    const clientId = document.getElementById('client_id').value;
    const token = document.getElementById('token').value;
    // get macaddress of the machine

    try {
        // Validate token with your backend
        const response = await fetch('https://steam-price-extension.onrender.com/api/validate-token', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': token,
                'x-client-id': clientId
            }
        });
        if (response.ok) {
            // Store token in extension storage
            chrome.storage.sync.set({ 'authToken': token, 'authClientId': clientId }, () => {
                document.getElementById('submit-token').textContent = 'Token saved!';
                setTimeout(() => {
                    window.close();
                }, 1000);
            });
        } else {
            document.getElementById('error-message').style.display = 'block';
            chrome.storage.sync.remove(['authToken', 'authClientId'], () => {
                chrome.tabs.create({
                    url: 'onboarding.html',
                });
            });
        }
    } catch (error) {
        document.getElementById('error-message').style.display = 'block';
    }
});

// validate on startup if token is already stored
chrome.storage.sync.get(['authToken', 'authClientId'], (result) => {
    if (result.authToken && result.authClientId) {
        fetch('https://steam-price-extension.onrender.com/api/validate-token', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': result.authToken,
                'x-client-id': result.authClientId

            }
        }).then(response => {
            if (!response.ok) {
                chrome.storage.sync.remove(['authToken', 'authClientId'], () => {
                    chrome.tabs.create({
                        url: 'onboarding.html',
                    });
                });
            }else{
                console.log('Token is valid');
                window.location.href = 'popup.html';
            }
        });
    } else {
        console.log('Missing authToken or authClientId');
    }
});