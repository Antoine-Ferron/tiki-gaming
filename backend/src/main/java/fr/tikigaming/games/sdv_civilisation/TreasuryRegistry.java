package fr.tikigaming.games.sdv_civilisation;

/** Contrat sans I/O : registre des pièces de chaque joueur. */
public interface TreasuryRegistry {

    int balanceOf(String player);

    void setBalance(String player, int coins);
}
