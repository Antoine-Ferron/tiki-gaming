package fr.tikigaming.games.rush_hour;

import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;

/**
 * Les 20 niveaux, connus du serveur pour vérifier les parties. Copie de frontend/src/games/rush-hour/domain/levels.ts :
 * LevelsTest et levels.test.ts vérifient la même liste de minimums de coups, pour que les deux restent identiques.
 */
public final class Levels {

    private static final List<List<String>> MAPS = List.of(
            // Niveau 1
            List.of(".FCCA.", ".F..AH", ".XX.AH", "..B..G", "EDB..G", "ED...."),
            // Niveau 2
            List.of("....A.", "DD.GAB", ".XXGAB", "...C.E", "FF.C.E", "...C.E"),
            // Niveau 3
            List.of("..FFA.", "CC.DAB", ".XXDAB", "......", "...E..", "...E.."),
            // Niveau 4
            List.of("..EEA.", "...CAB", ".XXCAB", "HH.II.", "FF.D..", "GG.D.."),
            // Niveau 5
            List.of("G.HHA.", "G..CAB", "GXXCAB", "EE.FF.", "......", "...DD."),
            // Niveau 6
            List.of("HHGGA.", "...CAB", ".XXCAB", "EE.FFI", ".....I", "...DD."),
            // Niveau 7
            List.of("HHGGA.", "...CAB", ".XXCAB", "EE.FFI", ".JJJ.I", "...DD."),
            // Niveau 8
            List.of("...A.D", "II.AED", "BXXAED", "B..GG.", "F.CCC.", "F...HH"),
            // Niveau 9
            List.of("HH.FF.", "...C..", "XXBCIE", "JJB.IE", ".GAADD", ".G...."),
            // Niveau 10
            List.of("JJJA.D", "II.AED", "BXXAED", "B..GG.", "F.CCC.", "F...HH"),
            // Niveau 11
            List.of("..EDDD", "..EB..", ".XXB.A", "FFFCGA", "...CG.", ".HH.G."),
            // Niveau 12
            List.of("..EDDD", "H.EB..", "HXXB.A", "FFFCGA", "...CGI", "....GI"),
            // Niveau 13
            List.of(".IG.CC", ".IGB.E", "XXHBDE", "..H.D.", "..HJFF", "AAAJ.."),
            // Niveau 14
            List.of(".EEE..", "...B.A", ".XXBDA", "...BDG", ".IHFFG", ".IHCC."),
            // Niveau 15
            List.of(".BBBH.", "..E.HD", "XXECHD", ".F.C.D", "JFACII", "J.AGG."),
            // Niveau 16
            List.of("..DDDG", ".II..G", "XXFB.G", ".HFBKK", "EHC.AA", "E.C.JJ"),
            // Niveau 17
            List.of("II.EJB", "...EJB", ".XXC.B", ".H.CDD", ".HA.FF", "..AGGG"),
            // Niveau 18
            List.of("..FBBB", "..FJCI", ".XXJCI", "KHEAAA", "KHEGG.", ".DD..."),
            // Niveau 19
            List.of(".EEE..", "...B.A", "JXXBDA", "J..BDG", "JIHFFG", ".IHCC."),
            // Niveau 20
            List.of("..DDDG", ".II.LG", "XXFBLG", ".HFBKK", "EHC.AA", "E.C.JJ"));

    private Levels() {}

    /** Map du niveau (6 lignes de 6 cases), ou vide si le niveau n'existe pas. */
    /** Nombre minimal de coups du niveau, ou vide si le niveau n'existe pas. */
    public static OptionalInt minimum(int number) {
        return OptionalInt.empty();
    }

    public static Optional<List<String>> map(int number) {
        return number >= 1 && number <= MAPS.size() ? Optional.of(MAPS.get(number - 1)) : Optional.empty();
    }
}
