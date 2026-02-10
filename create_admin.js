const axios = require('axios');

async function createAdmin() {
    try {
        const response = await axios.post('http://localhost:3000/auth/register', {
            email: 'admin@athleticspro.pl',
            password: 'admin123',
            firstName: 'System',
            lastName: 'Admin'
        });
        console.log('Account created successfully:', response.data.user.email);
    } catch (error) {
        if (error.response && error.response.status === 409) {
            console.log('Account already exists.');
        } else {
            console.error('Error creating account:', error.response ? error.response.data : error.message);
        }
    }
}

createAdmin();
