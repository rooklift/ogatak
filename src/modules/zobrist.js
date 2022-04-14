"use strict";

const b_stones = [		// the trailing n here means BigInt
	0x8fa2c21bfd03e0c9fa250f737d510629n, 0xcfd791f81ff190c1e30410c4bbadec18n, 0xad7c6f592d006868ae4cc22f2cb57a8en,
	0x652a8474e6ef5600171c293ac6798d4cn, 0xf3a824bb5130a56383780858186e498dn, 0x28860c320f75dbfd14987e373b0e2dd4n,
	0x5ddbdb6cc4649b1b9eab53f34148a471n, 0x9cc612a33afa0bb160c3e016ac7e802an, 0xd9004e7c0fe40454ec949546f7ddc2efn,
	0x1390abebc939842a121b1d438d041f68n, 0x8fe67affef9b53eae6a308363b65f2b1n, 0x9d96a5c9d572b97981b7e9849e07d0e8n,
	0x179c587e66b2a6b369b7255f0f5ac7cbn, 0x4d1ae48541bc3a4107d32daaae983cacn, 0xf29641a1cdccb2e4afe8576094d2bb96n,
	0x01c91fcb1ce3c1d0296392f94ad06e7cn, 0xfe73f3361d878aaddf322ce838de4a72n, 0x2a1429d7387bc558cd24759c80d9a7b2n,
	0xe069500fc3729d90c5d8c860a3ae97e1n, 0xd2352e657af4bb884cb1affeaa5870a8n, 0x74853b2381c8b6ff3c98e95d4e10bd5an,
	0x76dd8ac153fd9f913690dd9e530fea8en, 0xec1963118910c66496163dd51d9449bcn, 0x699f5324daf52c8567a7565f7af07547n,
	0x829fd27048484fe9a061cf57c54099aan, 0x0a713ab2b69cc52281d22ab4b50b039en, 0xb3505bd59bc2515f9371b9844689eb38n,
	0x8e15bf612703ce86f8a8eedd3c204815n, 0xa7eaf90382d55a7a2be852b9590b40ebn, 0xb1c6d8a457950d4582d9270c8cd3443cn,
	0x1a4e654a057235a158e446a789b406bdn, 0x24c95183f3b1df6456cc528140e266d8n, 0xca2a68f11b89dd9ef4f7a5f74784a40fn,
	0xa7ec3614a495a7284e00415ebd8d379dn, 0x29ed557032956f856f8483a00a89c920n, 0x7786cb69287737133392d27493959b41n,
	0x173ac4b42d478851f2725a265fe63c7cn, 0x67fc8c37d3f57ca682c7cfb356260f85n, 0xf3b6d01a163878b4e82b365cf42e2fbfn,
	0x6e92405ade225dd511098f68b5578281n, 0x2e22b228170498810a214ba2b4b5c639n, 0xc59911d81e24d0cf97edcc3feed093c5n,
	0x0c6eb9589be8ecc2556853a110483f3dn, 0x25b3b75617266acdcdfd0a195a3de721n, 0x8114453ca98865c6fadebc7fdee2347fn,
	0x87a82b67bfddb5e52b75535b76d45a67n, 0x8cfc30d3f6120f660ed5e4e4535181c5n, 0xc3097804795bc3a601ac20b6e098bbb0n,
	0xf826074ceb3bc8ca06fc132a75bc7db5n, 0x45681dcf5aa24cf14e62867b1877ec56n, 0xd60ed771998313cad275d9d217be5700n,
	0xf3922b7ca291358bb5fa78ed7a48bcean, 0xd6f71d6e9fa977f6a4c680366475b0fen, 0x74e85bc85965451a70c9d6bfdf0bf235n,
	0xe540e8228f0b3007923a20cd27c3fa51n, 0xf6f205428c6b1376b7d9277fa0e64b24n, 0xd0bb329181c46f26ae4f4b759340ade6n,
	0x52a0abaa7f59589cccde0390b2a20a51n, 0xe10eea03068ac81f3739f05bd0007711n, 0x916114a6e773498fbd88be3190287609n,
	0x7eace41432f6338c511cd6f516e2abf7n, 0x4445570b30112b6da5bd5b905e2a219dn, 0xb4b72864910d54fcb114ed2828cf7cden,
	0xd0a006d0094a95da6c7431ad8dfe6f9dn, 0x6b15bbccf8d54f57ebdd123d8f87b828n, 0xde3943c34670823719842d3e44c19e48n,
	0xaf959a56fe5578eaa0a3b54a3bf4a537n, 0xf369f0bf3b2211651697ccb64eb48567n, 0xe2863ce55e7fadd5ae87452058cd8bd4n,
	0x185069714d3ed3428f8cad3b34c99ed2n, 0x6bcd9f666122dd20b45a0654fc075694n, 0xaf4a8ede05f8708aae5dfe8f174ac4b2n,
	0x1a4c3b23765611e7cb11fba1c71d1250n, 0x85fa9aa79791117feca023b02c627e97n, 0xee53aaf2c45c177db5359760223de7f6n,
	0x28f0baab7e61607c7258df2d74ed6a60n, 0x0197b825eb3593ce26469f3616e78f59n, 0xffe749e24a139fd10c05b27cd06ff1abn,
	0xaafc6354be54c4dac1715030c0ff9fb5n, 0x05820748b3d82fb1ae1c955a8b6e120bn, 0x26b34ac67c67f372daf550e851a118adn,
	0xc4a93efbbccdab7e181fd2f5f38cd169n, 0xd0bc7c47ab88da8085c7259b1073be71n, 0x946c00572c488e240a156474331193dan,
	0xc36dbd808d997dbaea13efa3586cd130n, 0xc16be9f42c013b0011d23da8f90137ean, 0x07c58e60c0ab2cb94724a946a7f6fae8n,
	0xb90f0efe2cefc4aea9f2dcb73be6caacn, 0x47c74e0841860793b461a496e12606c5n, 0xe5ed6b366092c27756535eaa6eda0b43n,
	0x0d0b3b9b0209a9ab569fbe9ba1f40040n, 0x09b311d44a819dd376a61506e566862an, 0xa80be7e73f4836cff8674e4937aec934n,
	0x9982f9206eac1f856263581386295d34n, 0xd6aad8e04193027af0b8f3b59efc06bdn, 0xab1bc286e2ec86465cbc7c376a29c3f1n,
	0x359304a9abf9c70177cb0be16c465d23n, 0x37e0115bb36953a2b442839a50501e83n, 0x7bcfbc33a57125b61e3746ea24045337n,
	0x6526e60fe653d4510f726c8bea5eb21bn, 0x670708ead0fb230d562cdd9d1caebb46n, 0xcb1956c76dc3f60f8906d9bfce8255f4n,
	0x5f12b29ad117eb89d29774d7070fe11an, 0x8c53e6870e251eb151805574c1cbc5edn, 0xa7a2b68dde465ec3bfe25c9a8764a439n,
	0x3ddee72cb6f22d5b761e86fe4ed91589n, 0x456075f95a5292a98984387fdb746cbcn, 0xa7ed607219c51ebbbb577e858a750a88n,
	0x187515ca22ee0d7b5bc61bbf4d3811b7n, 0x87a0084f34f461fac37ee35a2098e9e2n, 0xbc9a8c01907241af0269d0f269cea464n,
	0xb62b5be4bf8f603cf4785d763c266283n, 0x4032f9282f5b5a60e00dab1f707b169an, 0xdd2efce64366279d1fdd5c8963b606e8n,
	0x34af1dc12586af9b9f7c171a5f33378an, 0x5f3dac4c7edd4946ab932fbe5fb06046n, 0x600c96715960c4a2af244d075f4d9481n,
	0xf2ee70ec645d07d793dd3e92b9a6c82dn, 0x6f073b1727d8fe1effe132f6be945cc7n, 0xe30ee11abea9f83d5e6a58f608eba382n,
	0x033475c0a5ad9575d578f171b27ed829n, 0xa068afb81118d098f19807e37dc81b6bn, 0xd56c1ae13c664eabe296b2c906e4e93fn,
	0xd2904cca9216ce8293ae8c831b21f481n, 0x4d4bd0086655c1dfdbeaadd503c7f146n, 0x13446345621112fe8bae7786489ffe76n,
	0x32f4334cbdcf4cbc7a6da6edd68a905cn, 0x160527aff0e37e602afc164577dde542n, 0x887d6edf6f0bbc4a8a216dbe80cdf069n,
	0x88419d03371a9f9aa0bd66f97e39401en, 0xe2929852d134214033eff11669392df6n, 0xb008e575319e4a5ecb03ca9af677561bn,
	0xc043ecf056c0132913dd8e2350032daen, 0x7cf4332d11531d1a7ec1b396f5d68312n, 0xec49e313fe70fcd6f8addc3ea1cbc703n,
	0xb071e8f00b775c2e5c8b9297fb432d3dn, 0xbfd82430028edaaf84b4811d45402088n, 0x25901adff8ae946e5d71fcf140060587n,
	0xe56bfa113ad8444ed7c87ba04edec934n, 0x9513b213deb04e3e3d6d53d53af5211bn, 0xbe08736329d070a509c9fd7b26ecf0e8n,
	0x75e8132eff5d5c3e76a11c300350e7e3n, 0xbdf7cf2ff83a140a74ed3902198b95fbn, 0x61b39441790b50d07ed7ee9b5b35f914n,
	0x4336b83bbd3fa71b7ae30822e87dc23cn, 0x9fa9b301f49d525930601198b2ee142bn, 0xed9bd8674cae6a75d4195f50d138eecan,
	0x8a505b02e062ea3860d836f356fe98d2n, 0x60600deb7e5bf57d0ab2b811f5d38c64n, 0x62c189d113edb92cf9f54ad5185fcf08n,
	0xa2b1dadf545a6362a8f0fb48e3d57a39n, 0xdf4abd871ed1908e4c4de43539de4df9n, 0x214eea6dc2441b6dfe0adc8a5c6932d0n,
	0xf9bc4c7866df412b8a6d684223bf90f4n, 0xe41bba901ea60dcd1973a06399ee452dn, 0x8a52e2908f7b9c7bc91586f5ee3097a0n,
	0x223af4847f1583caddb25a3006e92546n, 0x7a90fa3eb24c9f87dcf8aec74a856760n, 0xb37dd9eefcc1b48cfd07ebbe8b209d3en,
	0xbce10f8779314925deb723ade8124f09n, 0xee1189aa7f4dcaf678ee4ce599bb2a02n, 0xcbea91b24e83c7d3e8797bc070dc0ac5n,
	0xe94153e1aeef907255b45c631a2d2506n, 0x33dc4ad392c85a8e1c16bccb1423045fn, 0x5ea8b97d9822d6e2e5a7c24cf84aa2e8n,
	0x88e181e8fdad9c1959f896058dd65673n, 0xa08b3cc575ab093add2c39d3f95ba6a9n, 0xeee429fcb5ed536fbb07c25890fd663en,
	0x16f639250fe79232e5ece684d2a7d1a9n, 0x90cef07ec7aed942acc74d53e12486fan, 0x9ba6bdb552e9718ad464cd78a9e04238n,
	0x41b325ea7fea904655dfd466d41c58c6n, 0x194a3631902a30fc5eb9bebe9303ff34n, 0x47ec4b4992b1b7bf8e11ca6fc4b0e7dcn,
	0xa34adfeaa479adc4579e7e22c0749756n, 0xf01b92bd3fae4a6b874766c06c1e701bn, 0x04ca26f04b4675147ffa8f173f0a91b4n,
	0x9f583f2b61bfdc6ebc5432c16406413cn, 0x19f0fa734655398e8270c7187051f138n, 0x7909194353c4c4179bab7e18b10a098cn,
	0xb60e87951bff478f155d48f6c5f35e5en, 0xd5b3cd3e1e1d0e05ebec382c5f5ae9d7n, 0x5304ec176a6841dbc20c46e2568bcdccn,
	0x87b27f6c3e86b8928fcd6c20fba9b1bdn, 0x6b109962fc19a4bd9c106325ce20e49dn, 0xf0139e0af5fc460645129c008b50f2dcn,
	0x28e07234680ad2cb751a4b5917534714n, 0x32adaebbc1093c6f09e482a036875351n, 0xcd7a880eabbe238551e738955581e4d0n,
	0x200fc6c3983f5bc0a4748aa3499d84e2n, 0x8f405b0ca9a862292d48fdf50a79a3f0n, 0x9ca4cad44d0c994b96e89732ead48c7an,
	0x85507ad389a288bfdb22a627b55d9501n, 0x41c3b229e834501a499fb48a9f34c616n, 0x61ac4371ceb7fb0a8e4b8ed67d8682b4n,
	0x2d1adf3beb74c0277ad5c561a790ca09n, 0xb15b20e9a892d759be238efd6578e14bn, 0xe753d15ac58117ae3def96031487d238n,
	0x172d1a863fec1a2499e94fdfc81d5301n, 0x08786992637d02dfe66529e2ac9cc7b5n, 0xe03e8cabf12fcfc19adf8262642ea7d4n,
	0xf36b98459bdd527f88f69a3e07e050cdn, 0x628c1e3758654b3ef00f2f9931229aafn, 0xa995b9cf6f9c2051eacb95acabe8a769n,
	0x428f7679c284a6bfb8ebdeee2c3b3f4an, 0x376f9a9610bea9ca250339d7fc15d870n, 0x0503b94f9bbc898dd6c10c195b4d71c0n,
	0xba2ca42b893f92487067ae0d6833cf8fn, 0xd87b8f92a3b574d64673ffb7c8488494n, 0x2373dc91be6c439702350713b78e59a9n,
	0x30cc0dece5767b769f0bc4ff40d019dcn, 0x8287c0672632e8585f2ef4061818e1b0n, 0xc23c8d0afb208d2a7983e7fbbf290f4an,
	0x63245c8816aacc128f687f71f12d9d76n, 0xba01851ed1662ff6ef3479df6bf779e5n, 0xf526d717c7af22aa42a2c94dff7f356bn,
	0x71594b87b99b7a8a2658b552e3136e1an, 0x91ce369ce3bf82198b2b2b69b57e0859n, 0xed499fac9e64232b643d5cff473621dfn,
	0x4b27bc4796fd3aac7df6044835ae5e17n, 0xe3ffeda75c24bf63852504a1273dfbcan, 0xab2f71f75a21efc8ae03d6058e641c0fn,
	0x5ca3a0862a9c06524d5a94fdd0a5ba77n, 0x485f9ca56effd26b2b724753d7c4bdden, 0xff9ed183e1e34c6f8457ce2bb482000an,
	0x5fb3228a6ff3fc43ea69711d90dc5784n, 0xc8e3bb93434d26c4b01517f74e18f2afn, 0x57c8b25836f14b02a8ac641e3faa95fbn,
	0x1971b39af42d4906f6ccef62f13d97aan, 0x1f8a7579cb0d0abde061317161230635n, 0x1fd6266f379a71bcf155d99b9baa9a75n,
	0xb1358fbaf7d0453a789694553212326an, 0x348316d695ebd45be43450a7b7dcf343n, 0xcb5f49b5f0ec473cf9cbabdf550fe6ffn,
	0x1850614c9a23fcd7fffd310c2ef9df41n, 0xedfc6a407940471eca2c35f1352f85a8n, 0x7619a7bf020e24864c456a3cd1f8cd1cn,
	0x2428e806344675349c191e35e9de7ecen, 0x0898ea59684c12f9b6007e7ff20d98a8n, 0x1fc14478b85438b7cabbd91b5e2959f7n,
	0x9f4ef3d20ac124a11bf7bc975e8f8f87n, 0x35af4441babccb6454e038b06bb6af3en, 0xf6aa1c2e04e5cf665a133fc6324f9769n,
	0xf5700643d9ede13920bec9fb54235978n, 0xf6161252301caedef47166c7c740c761n, 0xe83ece8a2bdc72c72770e3dc2f20562an,
	0xeaad1937a3233b0d5c92af3d37001ad5n, 0x193827b1b89afc24dcd1172190d38277n, 0xaaf4ec8301dbe51332873fbe4880f32an,
	0x723ee6b86d8aa11585938bda0e0a9c14n, 0x0598c59a204460dc9109c1b9ae2d5dd0n, 0x25cc2542d78c2f8d8f968d7006e3f802n,
	0xc30c9f79faa3f5282ade436532da646en, 0x64fafc3a45230c5b42fcb31f5a0a21a1n, 0xdbd3b24a79af8bec5d1c7e827cb9fc91n,
	0xdb217c90fd75758e664d56a7ff3b5b5fn, 0xcca62e407903ee27ab8bb872efc393c7n, 0x76a7249f8c3936d40e526f4d791b774cn,
	0x528deb3435eab5b3d2ea8aff2d43bd82n, 0x8fec287be8e86409c1fa442048c4e0a6n, 0x137fbb4cb289a231621ac6af8ba95828n,
	0x2e7bd3f09b814d76abac44e88320429bn, 0x10e2a2f3c3530b06bdf63ca118c9ac63n, 0xc41a91c1391d1fa4cb3ac79a60cc9435n,
	0x26ac93d6ce9828fa4caadfda9142b981n, 0x27e669db5d01d2d6215acda0beae0db6n, 0xd66f60a1caafb603009ffab06670d7f2n,
	0xaf82b495f6d6eb722bb94d96c7340b79n, 0x765c6ba2b6fb495496df49b11016c01an, 0xa0ba519e1a9c6561eb250978c6efa9can,
	0x75fc662654970efb403185d38c4f3648n, 0xb40eb3ff2542614efcaca44cb3a66d91n, 0x312efd3bc0c13a7903a1d525f0fdd8een,
	0xf81921abbd456df445dc0777477a9167n, 0xf0ba24728f3150e14a073105366d2cccn, 0x51bb7a5c47b6572384d78130fd257f38n,
	0x84a92951e1264ec1b27fb676af900f32n, 0xf1878fcedbdacbfaf0a9b87f567c02d1n, 0x0238724db86fb3a427bff2144d042a4en,
	0x0a624c7b95f13fa74149f5103c0c7137n, 0xacefe67e13efe0003f83f825ff7e28c9n, 0xf9fd84313906f616c1e767e717c1bda9n,
	0xf4e0f1b5076816de0ad1f7b117021029n, 0xa51e6f811e7a85946f7d4c400f88f42bn, 0x2291477e1583a6d727e162a86bf6a05en,
	0x2c69c5713add98b638cd2fee73b85c0an, 0x1c5343df1be0855af8063b6e580d9ccbn, 0xf64ab9c8cef72a96908f29396d36f85en,
	0xed1be60a295885e4d1b4e1962ce755c2n, 0x2f9f6254bc5f5eb9590a73877bf1e421n, 0x1b40d44f9f30de1e5e93e5c7a363f6abn,
	0x6a10bd9c8fc24722c86bbf91cff79162n, 0x1dd8f2cfd4200a504a46ca90ab8858b9n, 0x7e16219f78a64f9557efbb981af53997n,
	0x44f54d725913b550a876d8f46eb0cdc8n, 0xa618879081b64c0cecb37692721578b5n, 0x5c122f5109cd3905e64719bfe42d9257n,
	0x9d89b556a28bc470268b7cba9996301dn, 0xfc8c62897e106a5d3e8b90d6260e7976n, 0x0e0b6f9b3d659ce72e95438956995ee7n,
	0x40b380926412d84af817f26357039698n, 0x3c539647b667e8bc580b5caec454f9f9n, 0xd10cbfeebd929e6a63dc93db08af9d15n,
	0x73b916580f7c9f6bd64fe16fcf55bd52n, 0xcd2a8c3499a3019a2f5e918c7122f688n, 0x14cbb08b6739fd96f8feb37f0d72806dn,
	0xc0db7b88e7bbdc4d357eedc3e74ce3f4n, 0xf45ab91fb5e99db69ff82f5c3c3e04a8n, 0x611530921d3956f70ba90a70bfc0ecabn,
	0x0fe52eed578fd13378179c2340eaed6dn, 0x17b49fbe230efebd3c49bdc2622f0e01n, 0x570a62211df8964a1ebd03110b95c968n,
	0x768b4982fdb8c565c316474dc8257392n, 0xa789f778a573ede9f99c91b9500e53f2n, 0x9ee5384ebc857fb719aa76c8f58fc647n,
	0x3217cf38a35636543be58d50cb62c48an, 0x021b8e194d09c0e443dd84da909f02c7n, 0x7e5a487c4bcacc9b6ff1338ffe5fc683n,
	0x8c07dd32c254554f17e760b95cc1ec68n, 0x4abae6d3e9b207bb73055ab9bea7d9b0n, 0x38c7d0a76371ff51e31e9abc082f8cc4n,
	0xe456d35fc3804041bfbc98e78031ce0dn, 0x5ed4d6ce594d6cbbde78bf95bb2c21aen, 0x5d9bb081abda991702ed00e57ba04122n,
	0xd99092c99923563ea5165c8c29a0c3c4n, 0x1e369a541b200b4b0da9fe03f21a1bb9n, 0x48bab4252ff33fa35d72e06683deca91n,
	0x09e4f035b2d0611f9188b01e1ad09ebcn, 0xecd57ef1879140ca334c05d173122943n, 0x78f8062c00d9110aa45e3c9950944962n,
	0x56fcf72d7d3c872815e4c9d68dabfa58n, 0x913d6a26f54b7ba624645da659b13992n, 0x4e88b212b64c4aa614b2b1ccd5262c74n,
	0x7c7b6d858d3efc75fc52257cf13a6f51n, 0x8dbe8f572bb3e198f60f6d0a73f54763n, 0x28fe4f44ad776659b4d65ef4bcc45920n,
	0x18d7ae0df3493ae41226514c271e32ddn, 0x609ffd1bbe70bda03edf2384bf13e777n, 0x7622eb2b6e240c0c3b6eaae45b4a0a0en,
	0x5a8626a3648c3abdf97996884b1a1134n, 0xe7492eb8d3954bff051ba14999221ab0n, 0x6b37a1a8a7a20ac21847281fe15982afn,
	0xcdda56aa837bf719a69ad4dbf803563an, 0x839a588c4aac9ddfa2d6a6796639bc4an, 0x2c71e22dda0d43a745a62ce44dd2f83bn,
	0x2a1de849d3951ce6190b336aa98321f8n, 0xe7440053327ecd52c0a1ab74d6d0880an, 0x53da48fbc933a87291c16f59777d6632n,
	0xb354ab51307fee2008136c5bdd60e8ban, 0xd6801055e21f427ac6ee9a6bcb63ec59n, 0xd3f903e799df0de4ec8962dc11ef6847n,
	0x93befa99b2d05178ee23b59eab3f8d28n, 0x5b7fb03d207f6409b7a5175a1159fa28n, 0xeefa2ad16eaad36a35ca55cf366164f7n,
	0x2b546f49610c45d6f52369d20fb7d05en, 0xaa9211a6bc1495c5cdc408f1f6e231f3n, 0x670f147ff78d06e11dd216b274dd3d7fn,
	0x300a517d6ab6327489c82eb1d6589276n, 0xbc4482d7561ede083956dfbc0e384c4en, 0xfe373c5f5c239bc28adb6bab21e60056n,
	0xbdb759f32598227fbce6d732f01c5982n,
];

const w_stones = [
	0x70c7781ca8b1a5f7a2bb48a79d586016n, 0x7b9bd9dfd6ebbf0634f1346ef26ab0ecn, 0x0cb79b1e8523491c93a0f78d1ffb990bn,
	0x6ff9bfca8a5cf88a89e62983bf53c307n, 0x7149eaf24c9a7d3eace6ce427ab6d131n, 0x7242e3a11c8a5f4a5df4dca869526479n,
	0x383d412e6ad2d5a66fa41051f9566583n, 0xe20e383ead91a060c07007f122cc0877n, 0x818c47c2d8bd505f633994fb8b9a6e0fn,
	0x69993b6adefcd5d2b31bcdfb418dfee0n, 0x706230175a9f97eb0ab794e10409162an, 0x3f1a8f8050c51a9c75da93877c8528a2n,
	0x4c5fb5302156454bcc76f97d655ea7d7n, 0xb22ee2bd775ab3db79cfe5406cd00a14n, 0xd9e3af1cb39ae9ea48b756c0561ca7a3n,
	0x5624028c02c56423a3fe0f238f59a237n, 0x6db590180820b3a66ff490760d8233f8n, 0xc0a3cde77df37bd699dd722889d5a351n,
	0x8ae21375f3bc2fa14bf28f9a9740595en, 0x9b16632b0c575f18385adf37f3f85a79n, 0x040f3b48870c07f212636556cc1b4293n,
	0x8ba52466f9e2c93d7d2c181242d4af59n, 0x2b1684252bb009cbc7d12c3c1d26a6f2n, 0xb541b6132aa8e66188887c15382f9d61n,
	0xdfe5f54f8dab0e34ff9d82a8a1c30554n, 0xc2b664b5ce28189d1d83541f54443f8en, 0x4f8fb2628f242e5084af059565206c80n,
	0xe82b311bb95d5ff3452f7459dc31a5b3n, 0xdf8f831e7c20295da67c693cb5869814n, 0x894924f7dd20792151c122d01449dfd4n,
	0x582f114df6da0d5fa4a71595a6a061e8n, 0x19f0349cbcb9cf5e7aac06ebd59618cen, 0x3a2dac81913be2dffa83c366af000f2an,
	0xab8b83b6f05d803edd909fb7bb9b459en, 0xefbbab7e6c399b9df14d8205f46728d8n, 0xc88cd31d54154c300758cd70fb1e3161n,
	0x32463d31db15b1b14501b060178ea715n, 0x0cb8a395451423fa206a7ea6fe1e267dn, 0x8ac3afa9a5c23e7de4da2f17530b56f4n,
	0x6f70b1ef9fb6c8404bfa12aacaf06fe1n, 0xcfe182524252396ea625202e8cd3c3e0n, 0x20e2abab1b40db85afd85ce1dc3f799fn,
	0xdc3c2b66b9b728b9e6b2dd66ec7c945bn, 0xd8da1b8b641923758dbc85f8404a739dn, 0x6801f36649861909d289e10019b1ea44n,
	0x3a6e77cfe4ccec76893848767146540dn, 0x28c6d2a0b2585c4f8eade35514e78befn, 0x96ab074a5f7185c06438be25fc9c5177n,
	0x39e6a27df7fbc25b0728947bb6caeb67n, 0xb06397303d87158cb6ff36ac49aba991n, 0x5b73b5964d8c015dd46d4d4e1ee44c4an,
	0xb2450afadf18e71a0657ec8daa7332b8n, 0x3ffb6f595153ce3b77b8c70a933097b5n, 0x6ecbe84fb85bbe3d9c37c8f0fc10daa5n,
	0x9bd4d5ee71ab87be2828f5d20c322875n, 0xc7ba8618fab0c737495abd69347ea236n, 0x973d2b07456c58d30a42d4c1e7102c25n,
	0x738b4ac0a518215455f5edbcd2fa3b27n, 0x74da62224037d23bb4db07ff7135e08fn, 0x9739b6c7bdcd54ca5f8f8ab0a3fa7408n,
	0xbc3aabcbd5b7cebdbf7d5d0612687ff9n, 0x76e99d576b3afb9a433283810229b49dn, 0xc1747efca58025f7a1510169fcbcc8b5n,
	0x5c55dbb37b296c311607602760c30d7en, 0xd74c74bf830bd03dfd392408fee4922dn, 0x76d466a359f41dcd736fbbae7490d409n,
	0x15adee6b0d83a2a963e9786f60b55eb7n, 0xb13a165dcddc4f35090909745371719en, 0x6ca43edf4835f7b8358c31e48a730cffn,
	0x63218e1ac8c2a9c20387d0c9f9a250f1n, 0x3d2d9c31ab06a21796809043dc1d450bn, 0x0914bf91cbfbbad27bf640abf1256a3en,
	0xcb8b6f8972b39b1b325aa9b3084e793an, 0xa382261ee0c0995965b4138d0bbb96a5n, 0x3fe53fcc5a8c5258ff4cd0acc9fddad9n,
	0x75d62753ae905d9c6877cd4bf62778den, 0x84d731b9433de2aafdffbc0f64cc1af1n, 0x3681e9f72c0d577eafbe4d1a5eae619bn,
	0xd16931c88a2c65d16a5b8f3d76aa151cn, 0xb4042829b0825f34fcf1e866649fa72en, 0xce01f2d2cc6160cb5a61b62f9c7a0670n,
	0xfe33bcfa7deb546b55c40b84a6b1c94bn, 0xe135428720b8e4d18c32e98c9cf96f3an, 0x22314097cb29e6eac9feaa3ad8c10a35n,
	0xaa8e05d75c98a03086fee7260b8b2f37n, 0x9fceaef13809eb7160df746439529e11n, 0x84a1704cd8a8459a289290ef35b97cdcn,
	0xd74ef19b17acc01a007d1694f3fe6fa2n, 0x3b4fe443dd535dadbc4dfefce199c72cn, 0x0197301f711640ef90ebaa612bd68a93n,
	0x4efdbf7aa33141f92f79f3f58af2f530n, 0x1821995ce41623fdb6ff48eefcb64ca7n, 0x58a94ecc64d7dde289cb159d64f963a3n,
	0x23b6ed60d9f59f1bd1227cf57082f232n, 0xa637d51ea7299478e0fdb6bb4a30f94cn, 0xd92a6cf58aa15bccbb9d8e1a1562d1e8n,
	0x5b3afe980c929aed24dffb13a6d21c7dn, 0x775c77e64135599ec393ce64f282c19fn, 0x4881556e9137a0bd7e05ee2cba86e5e7n,
	0x82dbd0bea3cbfc36b9db0a26eb78e4c8n, 0xd8a8bddab7ead224360b2dcfce6650ben, 0x45e250bfa447c81918b34ae6bb60024cn,
	0x4209823cdde8e4f1c17498ff402471c0n, 0xee6cc32463cbbcd3dc664335cc6d56ccn, 0x2de2b57fb4b5ceb9aec4f630a6d6cc23n,
	0xb05bf0080d5c3c78957d43c13fb180cen, 0x2e6f42dfe26b160aef2ac6d9ca6ccc05n, 0xe3e59f9fda7fe0f94bf3cfffa4653a93n,
	0x68bcb85f186f35df429511fdb01177dcn, 0xb0cecef6361d6944485b08407e211976n, 0x4b8828a45428f82dabb35ad4c96d87e7n,
	0x55f9caa1d5618578f4f99bb168608cc7n, 0x2d8762a16c7e1f11d7b532b7bceaadb1n, 0x25a16221478209822a9d002f9a2986d8n,
	0x3f53ef16d4c999a8939b13d134e40c21n, 0x4f53926158b27f59075534fda14f1c64n, 0xeedb9cece4be660701facec486b56538n,
	0x3eb87a218fef2ada144d9ffd7566f5ebn, 0x627aa49c6fdecf787bab2df909584330n, 0x44346e8da2c171b39f999bbbcd1c9ce9n,
	0x7d63a00ac91442e1b2e1e7feafabb84an, 0x5f81039e0e187a03896efda63946d428n, 0x478b6a2a7280cafc796724a1b1ef43e7n,
	0x1dc09f54f3ac1d1c2326b38c804dafd6n, 0xf63223b3937dcf9806716493d38bb4a6n, 0x167323d5a2d1ff31efe00e94008233a8n,
	0x875733300a2f34cf55045d86a83e3bcen, 0x638f95e482c27cc17febf54c9ee013c1n, 0x63c27cbae10e9dbb68145e78db43bd1en,
	0xdb0622462c69bca77c7d0b98c369cb79n, 0x46d10a6b71e84fc77edba7096598c5ebn, 0xd06d38aef596df2e32d60d08f8721923n,
	0xd3f5dc23f80293b6b747002d06a5ec80n, 0xc85e3668d516a32b6c26772f45f8be28n, 0xe67be2497b7458993537e5541c0f8afen,
	0x7d34d508646ef13899ef9febdf7ea9dan, 0x672487791371c52a7fe325e21a26da29n, 0xeaddc3b039c28d9bba08394f71dc43b5n,
	0xead92f6b2a69771ff64b2048722070e1n, 0x368256e6d7300588ef92a6e72d4b5ce4n, 0x664ffffbf8bef6c5691fe8821700f1d9n,
	0x6e580a0a56ee0832c786194ff6f67be0n, 0xa8e19308b9e3fbbcb9350ce73f8c7bc7n, 0x1293ad473f64096b8c2ece74531ebc40n,
	0xd108a652584409f210d38c5aa72e3384n, 0x9189b48c97ebe81d7398305bd6ac20fcn, 0x7325e18973ad11af83f586820083ed5bn,
	0xf8e4f2b21cc5f71e2f048ebed8d04c62n, 0x7690e0ab0e1158dd3e78665ce152bbe3n, 0xe0401ee3a61d59058566f146ed6db8c7n,
	0x5714e5fc16261d1c91c62e716e33dc0cn, 0x88c374a885d2fefe80e2cf868f2dc5d3n, 0x0a8685c77282595454054b57ac9c4336n,
	0x96eaa83507795e93ad32d483de4570ecn, 0xd675a6fc57e0d7ba3ae5eb18322794a3n, 0x0fb097179c9d15a6f2653c56dbda6d91n,
	0x527c9e2c5775bbce4124ea7aa3230b29n, 0x677707b9c805a031d71f20bb1368ab5bn, 0x061cd1b3c5d96c8218c614f08a9c20b7n,
	0x5af7d3cd0cd2e9cbf69f93c9131c8519n, 0x8c2d75d63201c12cb93c7d061704aac0n, 0x7b6042c1a575c1a9e947646af8f7ae90n,
	0xb6962e031542d638fd6520b3a0f5f10en, 0xe6e81db8ca9f3f64122cea96acdb956fn, 0x563687ade30967fc62129d291bb967acn,
	0x5a4b0f61e71679cb0b3912d9620fbd73n, 0x0d522612138d0f41d92017e263af0f14n, 0x6e8af908cb12e6cfe4fc54e82ad783ean,
	0xdbd75eabd86a499c6298caf93fd2d554n, 0x1cd02150df8262f56617a359c90f0bbbn, 0x585086b71ef370272484518c7b3de5ffn,
	0x240b164a556f350cf3cac9e02ee5ab58n, 0x9d1228c7916bca889b6b6a18d8042e83n, 0xcfe7f13a93f8e986d91d2866bfc56c9en,
	0xd3a6f24088760040fe5bacd5293a0d5cn, 0x01f080aab5be1f471c2684f428148ef1n, 0x5c38d8d9e4e37234a94b39fc19bab0abn,
	0xdcd9ef8d1f122d2a4a9abcf69cdc5b5en, 0x23f053874ef5853b3bd425d2da5716b6n, 0x2bd8bee2b955ce2e48a6de0a118fd95dn,
	0x670f09ecaf72f2ca37fd1db2f56d5696n, 0xc2343e4584408b029edc5809029fece8n, 0x62f0d9bd406fdba8228e341ae2129798n,
	0x4a853f4782d944f831589981950e7c57n, 0x721e189b4020b55d4bf0f217a2804e5an, 0xae0412a5effff00a5a1478e34085a4e6n,
	0x78ae23f6b43091df4ee68dcde672d50fn, 0x0ce8a06d038a3687d63acc975efce32dn, 0x75984faad61cae268121ccfdccdcd30fn,
	0x71e69ef9f2986e8a7360797f74d0fb63n, 0x4ad31999025afc886d87f086e477811an, 0xf087479f4a437897981473d24124c099n,
	0x59836bc4c723f2be95e3cdba0168ddbbn, 0xb8de5a6487f86c4800b48bced6895c88n, 0x5082658e372cb955e78b443fa55723cbn,
	0x66d3d22b7c6f8d48f904ffeb374442f7n, 0x9e6f753761f7e53fd932271a6637dc74n, 0x6038227e98f5aafe02463c00b655bbe6n,
	0x92a808089088367463c5ab99b9fd87adn, 0xd1f5f369f57b77f5bca00297932c5c13n, 0x4d8d2a0fd94e14eb65e1bd965d638832n,
	0x88cdcfdaa4cd09128eeefe33954b8d1bn, 0x43195ed5392566b2f6aa4dc118cc4317n, 0x736594e12c675026fa3aacea97f671f7n,
	0x79222a6e76e04c014032a1eab298b8e8n, 0x48c07e10bb88fe47515d77cfd6005125n, 0x754dbd35ec051ea1df28ca416748c1e2n,
	0x3f3366a50c810126e838b01022e6dfa5n, 0xc6e58a96e68afc9b8ef00eae46d81f38n, 0x7d9b242c0b1e4b8fd3a416b3099c51e0n,
	0xb1fa24bd553cbc41ed8f752e0d993ca8n, 0x457ecf0323edde784d834a34fac9f976n, 0x047a1eef5550bc49a1aac1dc6a7b365fn,
	0x5c7efa0fc882e681b3313e4f7a3bb798n, 0x14015809cac004f6aabb9b8eb775caf0n, 0x1cbd52c02d1910f108c4f7cb777ea322n,
	0x051fd6d60328659e705a2a22d8163f38n, 0xa2f763e05bc792544c4f51d50af1107en, 0x80452c382daf1d7fb5f65ba3dc863f98n,
	0x129458e10a1858cc8d51830371d72fbfn, 0xb63dd1b16094738b6f5eabd18f03e1dan, 0x929db0dac8b2e3e895c210e67dfaf013n,
	0x1bac29d1ac570df2c48ec424dc37adb9n, 0x8084dbdbfafec5907e2bd85a0720560cn, 0x2a99470b02beeb93939c812ee2f02094n,
	0x847f45471653f65f4f7a77cf6e121023n, 0x8db629ff6c76f8cae95ac3d147de5dean, 0xe94ac131e0c68375488473ddedceb7dbn,
	0x0fa7e4efd1177a7476e2587d485eeef9n, 0x92411b7fa83590070d506818e8dfbb13n, 0x1920999b4050bcd893ad1369a33d21a2n,
	0xb64b94da5ce5c92da6e1db5327deab46n, 0xd6258c99c2e2229a751f9217cea499fbn, 0xde75523a3441b2132bb89dcf9051bcb0n,
	0x7e7175ac89448baa0a7c8b871c8a6802n, 0xcdb2c8c0fa10dc415a07a9984fd2f004n, 0xb3297ee6d2677b40ce962b5cdde9948an,
	0x57ac37967002700b373537ca2de217c9n, 0xb144852ec55c29a81a8d0d936a5420ebn, 0x2c3b5c4df5c6f99a7a58e6e723d67682n,
	0x3b92abded2bb9a4c7241f5cee53369d7n, 0x5decab453c54b34ceb45c43771702357n, 0x1c8a0a7c429dfde19857c431349ae174n,
	0xcec2df3af96dccccc58542d69aa9d14an, 0x3e56cdd273b5bb7517c665c3eb16cdb4n, 0x6fa8681ffc70271b02979ae4967f42ebn,
	0x628157cb294b4771460c80c31021a38an, 0x0ffb44e6b576afccb042e5043780a920n, 0x967b5d4eeed8039f8d736ad142eb1824n,
	0x566dcc1dabbcc9b6ba02b8a0220b529an, 0x352cd4cfa20c415e7e54d90745d739a6n, 0x7cebc163af967f5c7da1d90668f70896n,
	0xb5e610f423a6b08235fcbcace02d51ben, 0xf732d73cc8664d4b12a555641876f2e0n, 0xde4cf1f9ae401496075a0242ffc69f89n,
	0x416d7980dd914e4dc5b93b31fccb7e8en, 0xe6748d4d05781358a03107398e6ee125n, 0xc3b7480989da2813e592ab5ba68aa8f7n,
	0x4ed4fe1549309216011f0b863358a470n, 0x5e24b4b687cb414ad5b5484b9025cc98n, 0x8737e09e9cd2d711a03e111ed9ac54a7n,
	0x6af8422bf6b30ffa5918a3b2cbb8666en, 0xb9acc16312d585b4e4d742e727ded621n, 0x053d570f4dd3d9fb96ba1776ee4f9c0en,
	0x9767a8983f90efca7e8a8fe00c718debn, 0x124c2ef2203c198d73ded8400abc4c55n, 0xe235c2bf96810e0650fc2ddde08455bcn,
	0x67f52660f0cf54108d42e622a5edc8f2n, 0xe9232a0434145f1e38dfc75d92f8d20en, 0x43bff01790af4232e5fd9ca8c5a6a5b0n,
	0xcbd5fa4ad9a4edeb01d3268ec6bc9976n, 0x3545b58b8c695522febdaa355a96cf4an, 0x186373a78da79124335dfe6cd6deb952n,
	0x34b12b07b031a9c8a7526e5a06f6ef65n, 0x7f52ee7038d9efffa2a91020d38cb278n, 0x5e9858169d771aa3fd65d6da1efa8a3an,
	0x8dbecc0e107f1bacb70f74c1dc91b5ban, 0xecba626fa61ee133d6e3290272351b7cn, 0x697878c4a1cd1949f77d32cb85829929n,
	0xca1c6b419741ef72af08fc2b52241777n, 0x7ca4f163e0abc535313265db29253a29n, 0xef5f6595dbf92a7f219f0b83dcf56bden,
	0x4bfbd894baef1da5d9070b139a0d828en, 0x3bb4814c70675853cbe2dd8322e4e25an, 0xd45cbca10cb82e4e57d08e63adbb285bn,
	0x29957c1df738371881b55cc40e4c114fn, 0x9a28eb6b71b2f454cfa6a0ecb0959583n, 0x34b9f9be37f327a710a0c483a6fa044en,
	0x65cf105f983ee4447cd07051a15b07ddn, 0xf146192e5929c31f8b1eacbec2d4e928n, 0xbf655a80385e363725265d52b3fe74dfn,
	0x35da57e74133449f27e0c5b6998c998an, 0xe314fbb8bcc24aede57e25250d981fe6n, 0xe52e43ff91dee72cca7050ed49fdf579n,
	0x40ea187c4827de9ef866e37c0caf0f36n, 0x93521c6c171259b2ee87a3c566cdcd64n, 0x059fe6ea8714887a085a622a8694688an,
	0x9ac2b90126e046521826d93b9b677c67n, 0x020445355aef4bf9c52963d1c23dd458n, 0xefe8a9a36286f819e92b5c4b4f5496b6n,
	0xfeacb69d55eeddf11d9f39cba88a1475n, 0xf33a27cd1a18d7cf498895828f36e99fn, 0xfa18c4f51cbd39ec0f7f8235dc36c786n,
	0x9c18fbdfe88f00e0270e2d2fb4ae8a3en, 0xb64053e5ad628c9c83601f8f9405d421n, 0x872c9b0b67197a589dc02ca871eb207an,
	0xccb1176a1301e06014dce07ca4d6caf5n, 0x7351200eed055a1fe9766c49598cccddn, 0xa49d7d183f8173d2758527011f1570c0n,
	0x9993f39eeb0e6d371d556474a076df6cn, 0xe29296d622681497503322242bfeb6b0n, 0x6b5858b411ac0adbb2ede71333c6ced6n,
	0x9cf4136ff25880c48d3242304aa6438bn, 0x7de18ca9b23c8d888b8a0f18e8333651n, 0xa6ef046a7ebc2f9ade5626bf17b60793n,
	0xd19a0d1511035a944812f66f5f11a7dan, 0x1ccaf0e2389da190bb80f224022c8010n, 0xf3aa24ffb134124035f036c78fde52f0n,
	0xab7752f25b7994d1da21e51b86fa1192n, 0xfe74a8a91429a75105e35764cf2bc8e0n, 0xd886fdcabb44b46f98d6d447d36a6e72n,
	0xb0bad0b8d322fba9baa51e9407519e1fn, 0xabc6e7ffd2a62b23bd2823d1eb39b2fen, 0x076a650ef271932669177827865f32a7n,
	0x5827d8e271e6c578f532927a1a580078n, 0xc9a86923f70c975466d1bc42d2e57378n, 0xeabd1c863dd975c41a3a738c438abed6n,
	0xdc18d0c2331ee8654edf571e09b44bfcn, 0x576b6977d0510c9e15f934a77c660423n, 0xa80aef029de0ce84ed2ed0238dafb7fbn,
	0x096a23d4eade26291ed61a004263e02dn, 0xce077c8b68e25a9a64d782f922643ed0n, 0xa6e518fce099f808f2901ac40d2f3a0fn,
	0x0fd1db095b5cff36ba535f6771666465n, 0x59f5c8302a0a7b1f870655f842f5eddan, 0x30b59007b7d0d0dd12a61df8d2e03817n,
	0xf13f7ee4e02a30ed97d1537e0e1189a9n, 0x6bb89d0af981417da3a697131d0a3ec7n, 0x88fb1b480b0d15e0d03cd641b0ac3c5dn,
	0x02cc0823a7ae2450fdfa12abaa11a12dn, 0x8581ccb6931f878e1aa6f38f30890208n, 0x2e3e8e4e10e462c6979b698337547daen,
	0x7166b146befcfff920e76dcb81a6fc66n, 0x5d38ff6c9fa0e139683a904eb73ef24an, 0x455e7a4d9479977c53e72c592efc54e0n,
	0x27367aa88535f7c23c56c96f2c9b9d6en, 0x59e2bf5f9a359b74b28b154f90734dd7n, 0x31083c7c154a1bd1831875ec58c87699n,
	0x51dd2b0479d0bdd86c4ddee1b19a4043n, 0x68a53c3673bf375cdac419bdde66d123n, 0xa80989de7c4c52c1e3bd9afcff1e0c19n,
	0x96fee8acf5451e013acd06012f216571n, 0x4dfe75d97797bb38fe1ebdee9cc09250n, 0x46b4ed716bd16729cdea96e0ede40c55n,
	0x1dcffe617e659b7baadb8965b2afa69en, 0x56668990e29855a408435e0b0434562en, 0xb42739a1f4a89624ba532be0685d6b3an,
	0x2e7ac67d686b07540866615b8b094c8dn, 0xdb869e0020fdc6cf23311c3125dfca1dn, 0xe2da49a597670035c2954da5a33771bbn,
	0x62d8701fde583d54c32ca25c71776901n,
];

if (b_stones.length !== 361 || w_stones.length !== 361) {
	throw new Error("Bad Zobrist array.");
}

const b_to_play = 0x47e1ebdae69a5ded3ff8db1fa4e91845n;		// Actually this is probably a combination of width=19, height=19, player=B
const w_to_play = 0x1e0a00c7f4e33a30c3ed6785bcfcdb40n;		// Likewise, but for player=W

module.exports = function(board) {

	if (board.width !== 19 || board.height !== 19 || board.ko) {
		return null;
	}

	let hash = 0n;

	for (let x = 0; x < 19; x++) {
		for (let y = 0; y < 19; y++) {
			if (board.state[x][y] === "b") hash ^= b_stones[x + y * 19];
			if (board.state[x][y] === "w") hash ^= w_stones[x + y * 19];
		}
	}

	if (board.active === "b") hash ^= b_to_play;
	if (board.active === "w") hash ^= w_to_play;

	let s = hash.toString(16);

	while (s.length < 32) {
		s = "0" + s;
	}

	return s.toUpperCase();
};
