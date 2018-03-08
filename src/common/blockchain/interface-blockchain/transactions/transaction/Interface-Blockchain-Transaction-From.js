import BufferExtended from "common/utils/BufferExtended"
import Serialization from "common/utils/Serialization"
import consts from "consts/const_global"
import InterfaceBlockchainAddressHelper from 'common/blockchain/interface-blockchain/addresses/Interface-Blockchain-Address-Helper';

//TODO MULTISIG TUTORIAL https://www.youtube.com/watch?v=oTsjMz3DaLs

class InterfaceBlockchainTransactionFrom{


    /*

        addresses [
            {
                unencodedAddress1,
                publicKey1,
                signature
            },
            {
                unencodedAddress2,
                publicKey2
                signature
            }

        ]

        currencyTokenId: TokenObject,

     */

    constructor (blockchain, addresses, currencyTokenId){
        this.blockchain = blockchain;

        this.setFrom(addresses, currencyTokenId);
    }

    setFrom(addresses, currencyTokenId){

        if (typeof addresses === "object" && currencyTokenId === undefined && addresses.hasOwnProperty('addresses') && addresses.hasOwnProperty('currencyTokenId') ){
            addresses = addresses.addresses;
            currencyTokenId = addresses.currencyTokenId;
        }


        if (!Array.isArray(addresses))
            addresses = [addresses];


        addresses.forEach ( (fromObject, index) =>{

            if (typeof fromObject.unencodedAddress === "object" && fromObject.hasOwnProperty("unencodedAddress"))
                fromObject.unencodedAddress = fromObject.unencodedAddress.unencodedAddress;

            fromObject.unencodedAddress = InterfaceBlockchainAddressHelper.validateAddressChecksum(fromObject.unencodedAddress);

            if (typeof fromObject.publicKey === "string")
                fromObject.publicKey = new Buffer (fromObject.publicKey, "hex");

            if (typeof fromObject.signature === "string")
                fromObject.signature = new Buffer (fromObject.signature, "hex");

        });

        if (currencyTokenId === undefined){
            currencyTokenId = new Buffer(consts.MINI_BLOCKCHAIN.TOKEN_CURRENCY_ID_LENGTH);
            currencyTokenId[0] = 0x01;
        }

        this.addresses = addresses;
        this.currencyTokenId = currencyTokenId;
    }

    toJSON(){
        return {
            addresses: this.addresses,
            currency: this.currency,
        }
    }

    /**
     * valdiateFrom object
     * @returns from
     */
    validateFrom(){

        if (this.addresses.length === 0)
            throw "From.addresses is empty";

        this.addresses.forEach ( (fromObject, index) =>{

            if (! fromObject.unencodedAddress || fromObject.unencodedAddress === null)
                throw 'From.address.unencodedAddress '+index+' is not specified';

            if (! InterfaceBlockchainAddressHelper.validateAddressChecksum(fromObject.unencodedAddress) )
                throw "From.address.unencodedAddress "+index+" is not a valid address";

            if (! fromObject.publicKey || fromObject.publicKey === null)
                throw 'From.address.publicKey '+index+' is not specified';

            if (!Buffer.isBuffer(fromObject.unencodedAddress) || fromObject.unencodedAddress.length !== consts.PUBLIC_ADDRESS_LENGTH )
                throw "From.address.unencodedAddress "+index+" is not a buffer";

            if (!Buffer.isBuffer(fromObject.publicKey) || fromObject.publicKey.length !== consts.PUBLIC_KEY_LENGTH)
                throw "From.address.publicAddress "+index+" is not a buffer";

            if (! fromObject.signature || fromObject.signature === null)
                throw 'From.address.signature '+index+' is not specified';

            if (!Buffer.isBuffer(fromObject.signature) || fromObject.signature.length !== consts.TRANSACTIONS_SIGNATURE_LENGTH)
                throw "From.address.signature "+index+" is not a buffer";


        });
        
        if (!this.currencyTokenId || this.currencyTokenId === null) throw 'From.currency is not specified';

        if (!Buffers.isBuffer(this.currencyTokenId))
            throw 'To.currencyTokenId is not a buffer';

        if (! (this.currencyTokenId.length === consts.MINI_BLOCKCHAIN.TOKEN_CURRENCY_ID_LENGTH || this.currencyTokenId.length === consts.MINI_BLOCKCHAIN.TOKEN_CURRENCY_ID_LENGTH) )
            throw "To.currencyTokenId is not valid";

        //TODO validate currency

        return true;
    }

    calculateInputSum(){

        //validate amount
        let inputValues = [], inputSum = BigNumber(0);

        for (let i=0; i<this.addresses.length; i++ ){
            let value = this.blockchain.accountantTree.getBalance( this.addresses[i].unencodedAddress, this.currencyTokenId );
            inputValues.push( value );
            inputSum = inputSum.plus(value);
        }

        return inputSum;
    }

    findAddressIndex( unencodedAddress ){
        for (let i = 0; i<this.addresses.length; i++)
            if (this.addresses[i].unencodedAddress.equals( unencodedAddress ) ){
                return i;
                break;
            }
        return -1;
    }

    serializeForSigning( unencodedAddress, version, nonce, transactionTo ){

        let position = this.findAddressIndex(unencodedAddress);

        if (position === -1)
            throw "address was not found";

        return Buffer.concat ([

            Serialization.serializeNumber1Byte( version ),
            Serialization.serializeNumber1Byte( nonce ),
            Serialization.serializeToFixedBuffer( consts.PUBLIC_ADDRESS_LENGTH, this.addresses[position].unencodedAddress ),
            Serialization.serializeToFixedBuffer( consts.PUBLIC_KEY_LENGTH, this.addresses[position].publicKey ),
            transactionTo.serializeTo(),

        ]) ;

    }

    serializeFrom(){

        let array = [];

        array.push( Serialization.serializeNumber1Byte( this.addresses.length ));
        for (let i = 0; i < this.addresses.length; i++){
            array.push( Serialization.serializeToFixedBuffer( consts.PUBLIC_ADDRESS_LENGTH, this.addresses[i].unencodedAddress ));
            array.push( Serialization.serializeToFixedBuffer( consts.PUBLIC_KEY_LENGTH, this.addresses[i].publicKey ));
            array.push( Serialization.serializeToFixedBuffer( consts.TRANSACTIONS_SIGNATURE_LENGTH, this.addresses[i].signature ));
        }

        array.push(Serialization.serializeNumber1Byte( this.currencyTokenId.length ));
        array.push(Serialization.serializeNumber1Byte( this.currencyTokenId ));

        return Buffer.concat (array);

    }

    deserializeFrom(buffer, offset){

        this.addresses = [];

        let length = Serialization.deserializeNumber( BufferExtended.substr(buffer, offset, 1) );
        offset += 1;

        for (let i = 0; i < length; i++){

            let address = {};

            address.unencodedAddress = BufferExtended.substr(buffer, offset, consts.PUBLIC_ADDRESS_LENGTH);
            offset += consts.PUBLIC_ADDRESS_LENGTH;

            address.publicKey= BufferExtended.substr(buffer, offset, consts.PUBLIC_KEY_LENGTH);
            offset += consts.PUBLIC_KEY_LENGTH;

            address.signature= BufferExtended.substr(buffer, offset, consts.TRANSACTIONS_SIGNATURE_LENGTH);
            offset += consts.TRANSACTIONS_SIGNATURE_LENGTH;

            this.addresses.push(address);
        }

        let currencyLength =  Serialization.deserializeNumber( buffer, offset, 1 );

        this.currencyTokenId = BufferExtended.substr(buffer, offset, currencyLength );
        offset += currencyLength;

        return offset;

    }

}

export default InterfaceBlockchainTransactionFrom;