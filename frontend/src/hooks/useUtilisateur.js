import { useEffect, useState } from "react";

export function useUtilisateur()
{
    const [utilisateur, setUtilisateur] = useState(null)
    const [chargement, setChargement] = useState(true)

    useEffect(() => {
        let annule = false

        fetch('/api/me', {credentials: 'same-origin' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {if (!annule) setUtilisateur(data)})
        .catch(() => { if (!annule) setUtilisateur(null)})
        .finally(() => {if (!annule) setChargement(false)})
            
        return () => { annule = true}
    }, [])

    return { utilisateur, chargement }
}