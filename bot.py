import discord
import asyncio
from discord.ext import commands
from groq import AsyncGroq
import os

groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

MON_ID = 1113541776091914331
pending_replies = {}

SYSTEM_PROMPT = """Tu es SaviOrientation, un assistant intelligent spécialisé dans l'orientation scolaire des élèves de première.

Ton objectif est d'aider les élèves à choisir quelle spécialité abandonner.

Tu fonctionnes comme un conseiller pédagogique :

- Tu poses des questions sur leurs centres d’intérêt
- Tu demandes leur projet professionnel
- Tu prends en compte leurs spécialités actuelles
- Tu analyses leurs réponses de manière logique

Tu dois :
- Être sérieux mais accessible
- Donner des conseils nuancés
- Justifier tes recommandations
- Ne jamais être catégorique à 100%

Tu peux t'appuyer sur ces règles générales :

- Maths est important pour les études scientifiques et d’ingénieur
- SVT est important pour médecine et biologie
- Physique-Chimie est clé pour ingénierie et sciences
- SES est utile pour économie et commerce
- HLP est utile pour droit, lettres
- NSI est utile pour informatique

Tu fais des réponses courtes (3-5 phrases max).
Tu poses souvent des questions pour affiner ton analyse.
"""


# Historique par channel
conversations = {}

async def generate_reply(user_message, channel_id):
    if channel_id not in conversations:
        conversations[channel_id] = []
    
    conversations[channel_id].append({"role": "user", "content": user_message})
    
    # Garde les 10 derniers échanges max
    historique = conversations[channel_id][-10:]
    
    response = await groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": SYSTEM_PROMPT}] + historique,
        max_tokens=200,
        temperature=0.8
    )
    
    reply = response.choices[0].message.content
    conversations[channel_id].append({"role": "assistant", "content": reply})
    return reply


class Client(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.id == self.bot.user.id:
            return

        else:
            channel_id = message.channel.id
            pending_replies[channel_id] = True

            await asyncio.sleep(3)

            if pending_replies.get(channel_id):
                async with message.channel.typing():
                    try:
                        reply = await generate_reply(message.content, message.channel.id)
                        await message.channel.send(f"{message.author.mention} {reply}")
                    except Exception as e:
                        print(f"Erreur : {e}")

                pending_replies[channel_id] = False

        if message.author.id == MON_ID or message.author.bot:
            pending_replies[message.channel.id] = False


async def setup(bot):
    await bot.add_cog(Client(bot))
    print("✅ mini_Y0 est prêt !")
