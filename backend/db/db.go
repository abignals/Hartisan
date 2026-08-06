package db


import (
	"database/sql"
	"fmt"
	"log"
	"os"
	_ "github.com/lib/pq"
	// "github.com/joho/godotenv"
)

var DB *sql.DB

func Connect() error {
	// if err := godotenv.Load(); err != nil {
	// 	log.Println("Pad de fichier .env trouve")
	// }

	// host := getEnv("DB_HOST")
	// port := getEnv("DB_PORT")
	// user := getEnv("DB_USER")
	// password := getEnv("DB_PASSWORD")
	// dbname := getEnv("DB_NAME")



	// dsn := fmt.Sprintf(
    //     "host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
    //     host, port, user, password, dbname,
    // )

	dsn := os.Getenv("DATABASE")
	if dsn == "" {
		return fmt.Errorf("la variable d'environnement DATABASE est absente")
	}

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		return err
	}
	if err = DB.Ping(); err != nil {
		return err
	}

	log.Println("Connexion a PostgreSQL reussie !")
	return nil
}

func getEnv(key string) string {
	return os.Getenv(key)
}