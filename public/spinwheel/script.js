const socket = io();

function createWheel() {
    const segmentsInput = document.getElementById('segments').value;
    const segments = segmentsInput.split('\n').filter(segment => segment !== '');

    if (segments.length < 2) {
        document.getElementById('error').innerText = 'Please enter at least two segments.';
        return;
    }

    fetch('/spinwheel/create-wheel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ segments }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            document.getElementById('error').innerText = data.error;
        } else {
            const wheelLink = `${window.location.origin}/spinwheel/wheel/${data.wheelId}`;
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = `
                <p>Your wheel has been created!</p>
                <p>Share this link: <a href="${wheelLink}" target="_blank">${wheelLink}</a></p>
            `;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        document.getElementById('error').innerText = 'An error occurred while creating the wheel.';
    });
}