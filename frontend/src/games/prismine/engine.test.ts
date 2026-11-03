/**
 * TU — moteur du navigateur (engine.ts) : il trace la carte du joueur avec les mêmes règles que le serveur
 * (Engine.java). Fonctions pures, aucune doublure nécessaire.
 */
import { describe, expect, it } from 'vitest'
import { GREEN, NE, NW, RED, SE, SW, emptyGrid, nextPiece, prism, trace, withPiece, type Piece } from './engine'

const D3 = 2 * 6 + 3
const B3 = 2 * 6 + 1
const HAUT_D = 3
const BAS_D = 14
const DROITE_3 = 8
const GAUCHE_3 = 21

describe('trace', () => {
  it('dévie sur l’hypoténuse, renvoie sur les côtés plats et mélange les couleurs le long du tracé', () => {
    const one = (piece: Piece) => withPiece(emptyGrid(6), D3, piece)
    expect(trace(one(prism(RED, SE)), 6, HAUT_D).exit).toBe(GAUCHE_3)
    expect(trace(one(prism(RED, SW)), 6, HAUT_D).exit).toBe(DROITE_3)
    expect(trace(one(prism(RED, NW)), 6, BAS_D).exit).toBe(DROITE_3)
    expect(trace(one(prism(RED, SE)), 6, BAS_D)).toMatchObject({ exit: BAS_D, bounces: 1 })

    // Haut D → D3 (◢ rouge) vers l'ouest → B3 (◥ vert) : demi-tour → D3 vers le nord → Haut D.
    const beam = trace(withPiece(one(prism(RED, SE)), B3, prism(GREEN, NE)), 6, HAUT_D)
    expect(beam).toMatchObject({ exit: HAUT_D, bounces: 3, color: RED | GREEN })
    expect(beam.colors).toEqual([0, RED, RED | GREEN, RED | GREEN, RED | GREEN])
  })
})

describe('nextPiece', () => {
  it('tourne le prisme de la couleur choisie, ajoute l’obsidienne si besoin et repeint sans tourner', () => {
    const order: Piece[] = ['.', prism(RED, SE), prism(RED, SW), prism(RED, NW), prism(RED, NE)]
    expect(order.map((piece) => nextPiece(piece, RED, false))).toEqual([...order.slice(1), '.'])
    expect(nextPiece(prism(RED, NE), RED, true)).toBe('#')
    expect(nextPiece('.', RED, true, true)).toBe('#')
    expect(nextPiece(prism(RED, NW), GREEN, false)).toBe(prism(GREEN, NW))
  })
})
