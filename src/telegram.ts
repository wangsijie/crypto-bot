export const sendMessage = async (message: string, botToken: string, chatId: string) => {
	const baseUrl = `https://api.telegram.org/bot${botToken}`;

	if (!chatId) {
		console.log('No chat id, skip sending message', message);
		return;
	}

	const url = `${baseUrl}/sendMessage`;
	const response = await fetch(url, {
		body: JSON.stringify({
			chat_id: Number(chatId),
			text: message,
		}),
		method: 'POST',
		headers: {
			'content-type': 'application/json;charset=UTF-8',
		},
	});

	if (!response.ok) {
		throw new Error('Failed to send message');
	}
};

export const sendPhoto = async (photoUrl: string, caption: string, botToken: string, chatId: string) => {
	const baseUrl = `https://api.telegram.org/bot${botToken}`;

	if (!chatId) {
		console.log('No chat id, skip sending photo');
		return;
	}

	const url = `${baseUrl}/sendPhoto`;
	const response = await fetch(url, {
		body: JSON.stringify({
			chat_id: Number(chatId),
			photo: photoUrl,
			caption: caption,
		}),
		method: 'POST',
		headers: {
			'content-type': 'application/json;charset=UTF-8',
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('Failed to send photo:', errorText);
		throw new Error(`Failed to send photo: ${response.status} ${response.statusText}`);
	}
};
