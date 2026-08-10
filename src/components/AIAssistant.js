export default function AIAssistant() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="w-[360px] rounded-3xl bg-white shadow-2xl p-4">
        
        <h3 className="font-bold text-lg">
          Assistant Voyage IA
        </h3>

        <input
          placeholder="Ex: Voyage sans visa en août"
          className="mt-4 w-full rounded-xl border p-3"
        />

        <button className="mt-4 w-full rounded-xl bg-black py-3 text-white">
          Obtenir des suggestions
        </button>

      </div>
    </div>
  );
}