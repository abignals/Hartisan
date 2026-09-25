package main

import (
	"net/mail"
	"regexp"
	"strings"
	"unicode/utf8"
)

func validateRegistration(req *registerRequestUser) string {
	req.Email = strings.TrimSpace(req.Email)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Phone = strings.NewReplacer(" ", "", ".", "", "-", "", "(", "", ")", "").Replace(strings.TrimSpace(req.Phone))
	if req.Role != "client" && req.Role != "artisan" {
		return "Type de compte invalide."
	}
	email, err := mail.ParseAddress(req.Email)
	if err != nil || email.Address != req.Email || len(req.Email) > 254 {
		return "Adresse email invalide."
	}
	if utf8.RuneCountInString(req.Password) < 12 || len(req.Password) > 72 {
		return "Le mot de passe doit contenir au moins 12 caractères, dans la limite de 72 octets."
	}
	if req.FirstName == "" || req.LastName == "" || utf8.RuneCountInString(req.FirstName) > 100 || utf8.RuneCountInString(req.LastName) > 100 {
		return "Indiquez votre prénom et votre nom (100 caractères maximum chacun)."
	}
	if !regexp.MustCompile(`^\+?[0-9]{8,15}$`).MatchString(req.Phone) {
		return "Numéro de téléphone invalide."
	}
	if req.Role == "client" {
		if req.CompanyName != "" || req.Siret != "" || req.Description != "" || len(req.TradeIDs) > 0 || req.ServiceRadiusM != 0 || req.AddressLine != "" || req.PostalCode != "" || req.City != "" {
			return "Les informations professionnelles sont réservées au formulaire artisan."
		}
		return ""
	}
	req.CompanyName = strings.TrimSpace(req.CompanyName)
	req.Siret = strings.ReplaceAll(strings.TrimSpace(req.Siret), " ", "")
	req.Description = strings.TrimSpace(req.Description)
	req.AddressLine = strings.TrimSpace(req.AddressLine)
	req.PostalCode = strings.TrimSpace(req.PostalCode)
	req.City = strings.TrimSpace(req.City)
	if req.CompanyName == "" || utf8.RuneCountInString(req.CompanyName) > 160 {
		return "Nom d’entreprise requis (160 caractères maximum)."
	}
	if !regexp.MustCompile(`^[0-9]{14}$`).MatchString(req.Siret) {
		return "Le SIRET doit contenir 14 chiffres."
	}
	if utf8.RuneCountInString(req.Description) < 20 || utf8.RuneCountInString(req.Description) > 2000 {
		return "Présentez votre activité en 20 à 2000 caractères."
	}
	if len(req.AddressLine) < 5 || utf8.RuneCountInString(req.AddressLine) > 500 || !regexp.MustCompile(`^[0-9]{5}$`).MatchString(req.PostalCode) || utf8.RuneCountInString(req.City) < 2 || utf8.RuneCountInString(req.City) > 160 {
		return "Vérifiez l’adresse professionnelle, le code postal et la ville."
	}
	if req.ServiceRadiusM < 1000 || req.ServiceRadiusM > 100000 {
		return "Choisissez un rayon d’intervention entre 1 et 100 km."
	}
	if len(req.TradeIDs) == 0 || len(req.TradeIDs) > 20 {
		return "Choisissez au moins un métier."
	}
	seen := map[int]bool{}
	for _, id := range req.TradeIDs {
		if id <= 0 || seen[id] {
			return "Sélection de métiers invalide."
		}
		seen[id] = true
	}
	return ""
}
