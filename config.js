/* Configuration OrienRun – ce fichier doit être IDENTIQUE dans l'appli élève et dans l'appli prof.
   La clé ci-dessous n'est qu'une clé PAR DÉFAUT, publique (anciens fichiers). Chaque professeur choisit sa propre phrase
   dans OrienRun Admin (onglet « Export / Import » → Clé de chiffrement) ; les élèves la saisissent ou scannent son QR code
   dans leur application. Elle est alors enregistrée sur l'appareil et remplace cette clé par défaut. */
window.ORUN_CONFIG = {
  secret: 'orienrun-IbicibuS-MADORIBUS-mon pass tu ne le trouveras-pas',
  seuilGPS: 5   // distance maximale (m) entre l'élève et la balise, valeur par défaut d'une nouvelle base
};
