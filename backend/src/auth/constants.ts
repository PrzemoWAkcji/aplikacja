import * as dotenv from 'dotenv';
dotenv.config();

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    '[Security] JWT_SECRET nie jest ustawiony lub jest krótszy niż 32 znaki. ' +
    'Wygeneruj bezpieczny sekret: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
  );
}

export const jwtConstants = { secret };
