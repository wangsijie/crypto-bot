export const sendMessage = async (message: string) => {
	const botToken = process.env.BOT_TOKEN;
	const baseUrl = `https://api.telegram.org/bot${botToken}`;
	const chatId = process.env.CHAT_ID;

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
