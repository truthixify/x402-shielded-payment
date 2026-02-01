import { useState, useEffect } from 'react'
import { Account, Aptos, AptosConfig, Ed25519PrivateKey, Network } from '@aptos-labs/ts-sdk'
import { initPoseidon } from './lib/utils'
import { Keypair } from './lib/keypair'
import { Utxo } from './lib/utxo'
import './App.css'

const SHIELDED_POOL_ADDRESS = '0x6f765bf42e1d7a4fca976e8742379136b11a185cc7fe894d0fd99ce0bf7df564'
const FACILITATOR_URL = 'http://localhost:4023'

function App() {
  const [account, setAccount] = useState<Account | null>(null)
  const [balance, setBalance] = useState<string>('0')
  const [shieldedKeypair, setShieldedKeypair] = useState<Keypair | null>(null)
  const [utxos, setUtxos] = useState<Utxo[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [aptos] = useState(() => new Aptos(new AptosConfig({ network: Network.TESTNET })))

  useEffect(() => {
    const init = async () => {
      await initPoseidon()
      setIsInitialized(true)
    }
    init()
  }, [])

  const connectWallet = async () => {
    try {
      // For demo purposes, create a random account
      // In production, this would connect to a wallet like Petra
      const privateKey = new Ed25519PrivateKey(Ed25519PrivateKey.generate().toString())
      const newAccount = Account.fromPrivateKey({ privateKey })
      
      setAccount(newAccount)
      
      // Generate shielded keypair
      const keypair = new Keypair()
      setShieldedKeypair(keypair)
      
      // Get balance (mock for now)
      setBalance('1.0')
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  const depositToPool = async () => {
    if (!account || !shieldedKeypair || !isInitialized) return

    try {
      const depositAmount = BigInt('100000000') // 1 APT in octas
      const depositUtxo = new Utxo({ amount: depositAmount, keypair: shieldedKeypair })
      
      // TODO: Generate ZK proof and submit transaction
      const encryptedOutput = await depositUtxo.encrypt()
      console.log('Depositing to pool:', {
        amount: depositAmount.toString(),
        commitment: depositUtxo.getCommitment().toString(),
        encryptedOutput
      })
      
      // Add to local UTXOs
      setUtxos(prev => [...prev, depositUtxo])
    } catch (error) {
      console.error('Failed to deposit:', error)
    }
  }

  const makePayment = async () => {
    if (!account || !shieldedKeypair || utxos.length === 0) return

    try {
      const paymentAmount = BigInt('50000000') // 0.5 APT
      const serverShieldedKey = '0x1234567890abcdef...' // Server's shielded public key
      
      // Create payment UTXO
      const paymentUtxo = new Utxo({ 
        amount: paymentAmount, 
        keypair: Keypair.fromString(serverShieldedKey) 
      })
      
      // Create change UTXO
      const inputUtxo = utxos[0]
      const changeAmount = inputUtxo.amount - paymentAmount
      const changeUtxo = new Utxo({ 
        amount: changeAmount, 
        keypair: shieldedKeypair 
      })
      
      // TODO: Generate ZK proof for transfer
      console.log('Making payment:', {
        input: inputUtxo.toCircuitInputs(),
        outputs: [paymentUtxo.toCircuitInputs(), changeUtxo.toCircuitInputs()]
      })
      
      // Update local UTXOs
      setUtxos(prev => prev.filter(u => u !== inputUtxo).concat([changeUtxo]))
    } catch (error) {
      console.error('Failed to make payment:', error)
    }
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Initializing...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8">
          🛡️ Shielded Payment Client
        </h1>
        
        {!account ? (
          <div className="text-center">
            <button
              onClick={connectWallet}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Account Info */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Account</h2>
              <p className="text-sm text-gray-300 mb-2">
                Address: {account.accountAddress.toString()}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                Balance: {balance} APT
              </p>
              {shieldedKeypair && (
                <p className="text-sm text-gray-300">
                  Shielded Key: {shieldedKeypair.address().slice(0, 20)}...
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Deposit to Pool</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Deposit funds into the shielded pool for private payments
                </p>
                <button
                  onClick={depositToPool}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-semibold"
                >
                  Deposit 1 APT
                </button>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Make Payment</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Make a private payment to a server using x402
                </p>
                <button
                  onClick={makePayment}
                  disabled={utxos.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold"
                >
                  Pay 0.5 APT
                </button>
              </div>
            </div>

            {/* UTXOs */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Your UTXOs ({utxos.length})</h3>
              {utxos.length === 0 ? (
                <p className="text-gray-400">No UTXOs found. Deposit to the pool first.</p>
              ) : (
                <div className="space-y-2">
                  {utxos.map((utxo, index) => (
                    <div key={index} className="bg-gray-700 p-3 rounded text-sm">
                      <p>Amount: {(Number(utxo.amount) / 100000000).toFixed(2)} APT</p>
                      <p className="text-gray-400">
                        Commitment: {utxo.getCommitment().toString().slice(0, 20)}...
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
