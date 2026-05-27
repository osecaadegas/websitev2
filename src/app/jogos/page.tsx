"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

const GAMES = [
  {
    id: "crime-empire",
    title: "Crime Empire",
    description: "Constrói o teu império criminal neste jogo de estratégia",
    icon: "👑",
    color: "from-red-600/20 to-red-500/10",
    borderColor: "#dc2626",
    soon: false,
  },
  {
    id: "memory",
    title: "Jogo da Memória",
    description: "Encontra os pares de símbolos das slots",
    icon: "🎰",
    color: "from-purple-600/20 to-purple-500/10",
    borderColor: "#9333ea",
    soon: false,
  },
  {
    id: "crash",
    title: "Prevê o Crash",
    description: "Adivinha quando vai crashar e ganha pontos",
    icon: "📈",
    color: "from-red-600/20 to-red-500/10",
    borderColor: "#dc2626",
    soon: true,
  },
  {
    id: "trivia",
    title: "Quiz das Slots",
    description: "Testa os teus conhecimentos sobre slots",
    icon: "🧠",
    color: "from-blue-600/20 to-blue-500/10",
    borderColor: "#2563eb",
    soon: false,
  },
  {
    id: "spinner",
    title: "Lucky Spinner",
    description: "Gira e tenta ganhar o jackpot virtual",
    icon: "🎡",
    color: "from-green-600/20 to-green-500/10",
    borderColor: "#16a34a",
    soon: true,
  },
];

export default function JogosPage() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const router = useRouter();

  const handleGameClick = (gameId: string, isSoon: boolean) => {
    if (isSoon) return;
    
    if (gameId === "crime-empire") {
      router.push("/jogos/crime-empire");
    } else {
      setSelectedGame(gameId);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white py-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">
              🎮 JOGOS DA COMUNIDADE
            </h1>
            <p className="text-lg text-[#888888] max-w-2xl mx-auto">
              Diverte-te com mini-jogos temáticos e compete com outros membros da comunidade
            </p>
          </motion.div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-6 text-[#ff6a00] hover:text-[#ff8533] transition-colors text-sm"
          >
            ← Voltar ao início
          </Link>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {GAMES.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              onClick={() => handleGameClick(game.id, game.soon)}
              className={`relative rounded-2xl p-6 cursor-pointer transition-all duration-300 ${
                game.soon ? "opacity-60 cursor-not-allowed" : ""
              }`}
              style={{
                background: `linear-gradient(145deg, #121212 0%, #161616 100%)`,
                boxShadow: selectedGame === game.id
                  ? `inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.6), 0 0 20px ${game.borderColor}40`
                  : "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.6)",
                border: selectedGame === game.id ? `2px solid ${game.borderColor}` : "2px solid transparent",
              }}
              whileHover={!game.soon ? { scale: 1.02, y: -4 } : {}}
            >
              {game.soon && (
                <div className="absolute top-3 right-3 bg-[#ff6a00]/90 text-white text-xs font-bold px-3 py-1 rounded-full">
                  EM BREVE
                </div>
              )}

              <div className="text-5xl mb-4">{game.icon}</div>
              <h3 className="text-xl font-bold mb-2 text-white">{game.title}</h3>
              <p className="text-sm text-[#888888]">{game.description}</p>

              {!game.soon && (
                <button className="mt-4 w-full bg-[#ff6a00]/10 hover:bg-[#ff6a00]/20 text-[#ff6a00] font-semibold py-2 px-4 rounded-full transition-all duration-200">
                  Jogar Agora
                </button>
              )}
            </motion.div>
          ))}
        </div>

        {/* Game Container */}
        <AnimatePresence mode="wait">
          {selectedGame && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl p-8"
              style={{
                background: "linear-gradient(145deg, #121212 0%, #161616 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.6)",
              }}
            >
              {selectedGame === "memory" && <MemoryGame onClose={() => setSelectedGame(null)} />}
              {selectedGame === "trivia" && <TriviaGame onClose={() => setSelectedGame(null)} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leaderboard Section */}
        <div
          className="mt-12 rounded-2xl p-8"
          style={{
            background: "linear-gradient(145deg, #121212 0%, #161616 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.6)",
          }}
        >
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            🏆 Top Jogadores da Semana
          </h2>
          <div className="space-y-3">
            {[
              { rank: 1, name: "JoãoGamer", points: 1250, emoji: "🥇" },
              { rank: 2, name: "MariaSlots", points: 980, emoji: "🥈" },
              { rank: 3, name: "PedroLucky", points: 850, emoji: "🥉" },
            ].map((player) => (
              <div
                key={player.rank}
                className="flex items-center justify-between p-4 rounded-xl bg-[#1a1a1a] hover:bg-[#1e1e1e] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{player.emoji}</span>
                  <div>
                    <p className="font-bold text-white">{player.name}</p>
                    <p className="text-sm text-[#888888]">Rank #{player.rank}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-[#ff6a00]">{player.points}</p>
                  <p className="text-xs text-[#888888]">pontos</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Memory Game Component ────────────────────────────────────────── */
function MemoryGame({ onClose }: { onClose: () => void }) {
  const SYMBOLS = ["🍒", "🍋", "🍊", "7️⃣", "💎", "⭐", "🎰", "💰"];
  const [cards, setCards] = useState<string[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  const initGame = () => {
    const shuffled = [...SYMBOLS, ...SYMBOLS]
      .sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setGameStarted(true);
  };

  const handleCardClick = (index: number) => {
    if (!gameStarted || flipped.length === 2 || flipped.includes(index) || matched.includes(index)) return;

    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(moves + 1);
      const [first, second] = newFlipped;
      if (cards[first] === cards[second]) {
        setMatched([...matched, first, second]);
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 1000);
      }
    }
  };

  const isWon = matched.length === cards.length && cards.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">🎰 Jogo da Memória</h2>
        <button
          onClick={onClose}
          className="text-[#888888] hover:text-white transition-colors"
        >
          ✕ Fechar
        </button>
      </div>

      {!gameStarted ? (
        <div className="text-center py-12">
          <p className="text-[#888888] mb-6">Encontra todos os pares de símbolos!</p>
          <button
            onClick={initGame}
            className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold py-3 px-8 rounded-full transition-all duration-200 transform hover:scale-105"
          >
            Iniciar Jogo
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6 text-sm">
            <span className="text-[#888888]">Jogadas: <span className="text-[#ff6a00] font-bold">{moves}</span></span>
            <span className="text-[#888888]">Pares: <span className="text-[#ff6a00] font-bold">{matched.length / 2} / 8</span></span>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            {cards.map((symbol, index) => (
              <motion.div
                key={index}
                onClick={() => handleCardClick(index)}
                className="aspect-square rounded-xl cursor-pointer flex items-center justify-center text-4xl font-bold"
                style={{
                  background: flipped.includes(index) || matched.includes(index)
                    ? "linear-gradient(145deg, #1a1a1a 0%, #1e1e1e 100%)"
                    : "linear-gradient(145deg, #ff6a00 0%, #ff8533 100%)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {(flipped.includes(index) || matched.includes(index)) ? symbol : "?"}
              </motion.div>
            ))}
          </div>

          {isWon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6 rounded-xl bg-[#ff6a00]/10 border-2 border-[#ff6a00]/30"
            >
              <p className="text-3xl font-black text-[#ff6a00] mb-2">🎉 PARABÉNS!</p>
              <p className="text-[#888888] mb-4">Completaste em {moves} jogadas!</p>
              <button
                onClick={initGame}
                className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold py-2 px-6 rounded-full"
              >
                Jogar Novamente
              </button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Trivia Game Component ─────────────────────────────────────────── */
function TriviaGame({ onClose }: { onClose: () => void }) {
  const QUESTIONS = [
    {
      question: "Qual é o RTP médio de uma slot online?",
      options: ["95-96%", "85-86%", "99-100%", "70-75%"],
      correct: 0,
    },
    {
      question: "O que significa 'RTP' em slots?",
      options: ["Return To Player", "Random Total Prize", "Real Time Payout", "Risky Total Play"],
      correct: 0,
    },
    {
      question: "Qual slot é conhecida por ter o maior multiplicador máximo?",
      options: ["Book of Dead", "Gates of Olympus", "Sugar Rush", "Mental"],
      correct: 3,
    },
  ];

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    if (index === QUESTIONS[currentQuestion].correct) {
      setScore(score + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      setShowResult(true);
    }
  };

  const resetGame = () => {
    setCurrentQuestion(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setGameStarted(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">🧠 Quiz das Slots</h2>
        <button
          onClick={onClose}
          className="text-[#888888] hover:text-white transition-colors"
        >
          ✕ Fechar
        </button>
      </div>

      {!gameStarted && !showResult ? (
        <div className="text-center py-12">
          <p className="text-[#888888] mb-6">Testa os teus conhecimentos sobre slots!</p>
          <button
            onClick={resetGame}
            className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold py-3 px-8 rounded-full transition-all duration-200 transform hover:scale-105"
          >
            Começar Quiz
          </button>
        </div>
      ) : showResult ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12"
        >
          <p className="text-5xl mb-4">
            {score === QUESTIONS.length ? "🏆" : score >= QUESTIONS.length / 2 ? "👍" : "📚"}
          </p>
          <p className="text-3xl font-black text-[#ff6a00] mb-2">
            {score} / {QUESTIONS.length} corretas!
          </p>
          <p className="text-[#888888] mb-6">
            {score === QUESTIONS.length
              ? "Perfeito! És um expert em slots!"
              : score >= QUESTIONS.length / 2
              ? "Bom trabalho! Continua a aprender!"
              : "Não desistas! Tenta novamente!"}
          </p>
          <button
            onClick={resetGame}
            className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold py-2 px-6 rounded-full"
          >
            Jogar Novamente
          </button>
        </motion.div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4 text-sm">
              <span className="text-[#888888]">
                Pergunta {currentQuestion + 1} / {QUESTIONS.length}
              </span>
              <span className="text-[#888888]">
                Pontuação: <span className="text-[#ff6a00] font-bold">{score}</span>
              </span>
            </div>

            <h3 className="text-xl font-bold mb-6">{QUESTIONS[currentQuestion].question}</h3>

            <div className="space-y-3">
              {QUESTIONS[currentQuestion].options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  disabled={selectedAnswer !== null}
                  className={`w-full p-4 rounded-xl font-semibold text-left transition-all duration-200 ${
                    selectedAnswer === null
                      ? "bg-[#1a1a1a] hover:bg-[#1e1e1e] text-white"
                      : index === QUESTIONS[currentQuestion].correct
                      ? "bg-green-600/20 border-2 border-green-500 text-green-400"
                      : selectedAnswer === index
                      ? "bg-red-600/20 border-2 border-red-500 text-red-400"
                      : "bg-[#1a1a1a] text-[#888888]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {selectedAnswer !== null && (
            <div className="text-center">
              <button
                onClick={nextQuestion}
                className="bg-[#ff6a00] hover:bg-[#ff8533] text-white font-bold py-2 px-6 rounded-full"
              >
                {currentQuestion < QUESTIONS.length - 1 ? "Próxima Pergunta" : "Ver Resultado"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
