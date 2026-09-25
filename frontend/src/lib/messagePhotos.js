export async function sendPhoto(conversation, file) {
  const form = new FormData()
  form.append('photo', file)
  const response = await fetch(`/api/conversations/${conversation}/photos`, { method: 'POST', credentials: 'same-origin', body: form })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Envoi de la photo impossible.')
  return data
}

